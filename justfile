# Task runner. `just check` is the gate CI runs.

# The Lightsail container service a deployed copy runs on. The region is
# named here rather than taken from the AWS CLI, so the container sits beside
# the Bedrock endpoint its model calls go to.
service := "orla-demo"
region := "us-west-2"

default:
    @just --list

# Run the API and serve the built frontend from one process.
serve:
    uv run orla serve

# Run the API and the vite dev server together, with hot reload on both.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    uv run orla serve --reload &
    cd web && pnpm dev &
    wait

# Install both toolchains.
install:
    uv sync
    cd web && pnpm install

# Generate the frontend's types from the Pydantic models.
types:
    uv run orla schema --out web/src/types/schema.json
    cd web && pnpm run types

# Regenerate the pydantic-deep reference the compiler prompt reads.
api-ref:
    uv run orla api-ref

# Build the frontend into the package, so `serve` hosts it.
build: types
    cd web && pnpm build
    rm -rf orla/static
    cp -r web/dist orla/static

fmt:
    uv run ruff format orla tests
    cd web && pnpm run fmt

lint:
    uv run ruff check orla tests
    cd web && pnpm run lint

typecheck:
    uv run ty check orla
    cd web && pnpm run typecheck

test:
    uv run pytest -q

# Mint the 30 day Bedrock key a deployed copy runs on.
key:
    #!/usr/bin/env bash
    # A user that may only invoke models, and a credential that expires. The
    # secret is shown once, at creation, so it goes straight into .env.
    set -euo pipefail
    user={{service}}-bedrock

    aws iam get-user --user-name "$user" > /dev/null 2>&1 \
        || aws iam create-user --user-name "$user" > /dev/null

    policy=$(mktemp)
    trap 'rm -f "$policy"' EXIT
    cat > "$policy" <<'JSON'
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "UseABearerToken",
          "Effect": "Allow",
          "Action": ["bedrock:CallWithBearerToken", "bedrock-mantle:CallWithBearerToken"],
          "Resource": "*"
        },
        {
          "Sid": "ConverseApi",
          "Effect": "Allow",
          "Action": [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:Converse",
            "bedrock:ConverseStream"
          ],
          "Resource": "*"
        },
        {
          "Sid": "MantleOpenAiApi",
          "Effect": "Allow",
          "Action": [
            "bedrock-mantle:CreateInference",
            "bedrock-mantle:GetInference",
            "bedrock-mantle:ListModels"
          ],
          "Resource": "*",
          "Condition": {
            "StringEquals": {"aws:RequestedRegion": "{{region}}"}
          }
        }
      ]
    }
    JSON
    aws iam put-user-policy --user-name "$user" \
        --policy-name invoke-bedrock --policy-document "file://$policy"

    # IAM keeps at most two of these per user, so the old ones make way.
    for id in $(aws iam list-service-specific-credentials --user-name "$user" \
        --service-name bedrock.amazonaws.com \
        --query 'ServiceSpecificCredentials[].ServiceSpecificCredentialId' --output text); do
        aws iam delete-service-specific-credential --user-name "$user" \
            --service-specific-credential-id "$id"
    done

    export MINTED=$(aws iam create-service-specific-credential --user-name "$user" \
        --service-name bedrock.amazonaws.com --credential-age-days 30 --output json)
    python3 - <<'PY'
    import json, os, pathlib

    minted = json.loads(os.environ["MINTED"])["ServiceSpecificCredential"]
    env = pathlib.Path(".env")
    kept = [
        line
        for line in env.read_text().splitlines()
        if not line.startswith("DEPLOY_BEDROCK_TOKEN=")
    ]
    kept.append(f"DEPLOY_BEDROCK_TOKEN={minted['ServiceCredentialSecret']}")
    env.write_text("\n".join(kept) + "\n")
    print(f"Wrote DEPLOY_BEDROCK_TOKEN to .env. It expires {minted['ExpirationDate'][:10]}.")
    PY

    # A credential answers 401 for a few seconds after IAM reports creating it,
    # which would otherwise fail the health check of a deploy run straight after.
    sleep 20

# Put a copy on Lightsail, or push a change to the one already there.
deploy:
    #!/usr/bin/env bash
    # Needs docker, the lightsailctl plugin, and credentials in the AWS CLI.
    set -euo pipefail
    set -a && source .env && set +a
    # The scoped key `just key` mints is what a deployed copy should run on.
    # Falling back to the personal token keeps a first deploy from stalling.
    export DEPLOY_BEDROCK_TOKEN="${DEPLOY_BEDROCK_TOKEN:-${AWS_BEARER_TOKEN_BEDROCK:-}}"
    : "${DEPLOY_BEDROCK_TOKEN:?run `just key`, or put AWS_BEARER_TOKEN_BEDROCK in .env}"
    : "${DEPLOY_PASSWORD:?needs a value in .env, since anyone holding the link reaches the demo}"
    # Everyone sharing the link shares one Bedrock bill, so the copy carries a
    # ceiling on what it may spend between restarts.
    export DEPLOY_SPEND_CAP_USD="${DEPLOY_SPEND_CAP_USD:-200}"

    state() {
        aws lightsail get-container-services --service-name {{service}} --region {{region}} \
            --query 'containerServices[0].state' --output text 2>/dev/null || echo NONE
    }

    if [ "$(state)" = NONE ]; then
        echo "Creating the service, which takes a few minutes the first time."
        aws lightsail create-container-service --region {{region}} \
            --service-name {{service}} --power micro --scale 1 > /dev/null
    fi
    while [ "$(state)" != READY ] && [ "$(state)" != RUNNING ]; do sleep 10; done

    # Lightsail names the image it stores, so the name is read back from the
    # registry rather than chosen here.
    docker build --platform linux/amd64 -t {{service}}:latest .
    aws lightsail push-container-image --region {{region}} \
        --service-name {{service}} --label app --image {{service}}:latest > /dev/null
    export IMAGE=$(aws lightsail get-container-images --service-name {{service}} --region {{region}} \
        --query 'containerImages[0].image' --output text)

    # The token and the password ride along in the deployment, so it is
    # written where only this user can read it and removed on the way out.
    containers=$(mktemp)
    trap 'rm -f "$containers"' EXIT
    chmod 600 "$containers"
    python3 - > "$containers" <<'PY'
    import json, os

    print(json.dumps({
        "app": {
            "image": os.environ["IMAGE"],
            "ports": {"8000": "HTTP"},
            "environment": {
                "AWS_BEARER_TOKEN_BEDROCK": os.environ["DEPLOY_BEDROCK_TOKEN"],
                "ORLA_PASSWORD": os.environ["DEPLOY_PASSWORD"],
                "ORLA_SPEND_CAP_USD": os.environ["DEPLOY_SPEND_CAP_USD"],
            },
        },
    }))
    PY

    aws lightsail create-container-service-deployment --region {{region}} \
        --service-name {{service}} --containers "file://$containers" \
        --public-endpoint '{"containerName":"app","containerPort":8000,"healthCheck":{"path":"/healthz","successCodes":"200"}}' \
        > /dev/null

    echo "Rolling out with a \$$DEPLOY_SPEND_CAP_USD spend cap. It answers at:"
    aws lightsail get-container-services --service-name {{service}} --region {{region}} \
        --query 'containerServices[0].url' --output text

# Set the account-wide billing alarm a deployed copy is watched by.
budget:
    #!/usr/bin/env bash
    # The app's own cap only counts what went through the app, so anything
    # that reaches the key another way is invisible to it. This alarm sits
    # outside the process and survives every restart.
    #
    # It watches the whole account rather than Bedrock alone, because Bedrock
    # bills third-party models under their own service names and a filter
    # would quietly miss most of the registry.
    set -euo pipefail
    set -a && source .env && set +a
    : "${DEPLOY_ALERT_EMAIL:?put the address the alarm should mail in .env}"
    export DEPLOY_BUDGET_USD="${DEPLOY_BUDGET_USD:-300}"
    export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    name={{service}}-monthly

    spec=$(mktemp)
    notes=$(mktemp)
    trap 'rm -f "$spec" "$notes"' EXIT
    export BUDGET_NAME="$name"
    python3 - <<'PY' > "$spec"
    import json, os

    print(json.dumps({
        "BudgetName": os.environ["BUDGET_NAME"],
        "BudgetLimit": {"Amount": os.environ["DEPLOY_BUDGET_USD"], "Unit": "USD"},
        "TimeUnit": "MONTHLY",
        "BudgetType": "COST",
    }))
    PY
    python3 - <<'PY' > "$notes"
    import json, os

    subscriber = {"SubscriptionType": "EMAIL", "Address": os.environ["DEPLOY_ALERT_EMAIL"]}
    print(json.dumps([
        {
            "Notification": {
                "NotificationType": kind,
                "ComparisonOperator": "GREATER_THAN",
                "Threshold": threshold,
                "ThresholdType": "PERCENTAGE",
            },
            "Subscribers": [subscriber],
        }
        for kind, threshold in [("ACTUAL", 50), ("ACTUAL", 80), ("ACTUAL", 100), ("FORECASTED", 100)]
    ]))
    PY

    if aws budgets describe-budget --account-id "$ACCOUNT" --budget-name "$name" > /dev/null 2>&1; then
        aws budgets update-budget --account-id "$ACCOUNT" --new-budget "file://$spec"
        echo "Updated the $name budget at \$$DEPLOY_BUDGET_USD a month."
    else
        aws budgets create-budget --account-id "$ACCOUNT" --budget "file://$spec" \
            --notifications-with-subscribers "file://$notes"
        echo "Created the $name budget at \$$DEPLOY_BUDGET_USD a month, mailing $DEPLOY_ALERT_EMAIL."
    fi

# What the deployed container has been saying.
logs:
    aws lightsail get-container-log --service-name {{service}} --container-name app --region {{region}}

# Delete the deployed copy: the service, and the key it ran on.
teardown:
    #!/usr/bin/env bash
    set -euo pipefail
    user={{service}}-bedrock

    aws lightsail delete-container-service --service-name {{service}} --region {{region}}

    # An IAM user cannot be deleted while anything still hangs off it, so the
    # credential and the policy go first.
    if aws iam get-user --user-name "$user" > /dev/null 2>&1; then
        for id in $(aws iam list-service-specific-credentials --user-name "$user" \
            --service-name bedrock.amazonaws.com \
            --query 'ServiceSpecificCredentials[].ServiceSpecificCredentialId' --output text); do
            aws iam delete-service-specific-credential --user-name "$user" \
                --service-specific-credential-id "$id"
        done
        aws iam delete-user-policy --user-name "$user" --policy-name invoke-bedrock 2>/dev/null || true
        aws iam delete-user --user-name "$user"
        echo "Deleted the $user key and user."
    fi

    echo "The billing alarm is left alone. Remove it with:"
    echo "  aws budgets delete-budget --account-id \$(aws sts get-caller-identity --query Account --output text) --budget-name {{service}}-monthly"

# The read-only gate, the way CI runs it.
check:
    uv run ruff format --check orla tests
    uv run ruff check orla tests
    uv run ty check orla
    uv run pytest -q
    cd web && pnpm run check
