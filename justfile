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

# Put a copy on Lightsail, or push a change to the one already there.
deploy:
    #!/usr/bin/env bash
    # Needs docker, the lightsailctl plugin, and credentials in the AWS CLI.
    set -euo pipefail
    set -a && source .env && set +a
    : "${AWS_BEARER_TOKEN_BEDROCK:?needs a value in .env}"
    : "${DEPLOY_PASSWORD:?needs a value in .env, since anyone holding the link reaches the demo}"
    # Everyone sharing the link shares one Bedrock bill, so the copy carries a
    # ceiling on what it may spend between restarts.
    export DEPLOY_SPEND_CAP_USD="${DEPLOY_SPEND_CAP_USD:-25}"

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
                "AWS_BEARER_TOKEN_BEDROCK": os.environ["AWS_BEARER_TOKEN_BEDROCK"],
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

# What the deployed container has been saying.
logs:
    aws lightsail get-container-log --service-name {{service}} --container-name app --region {{region}}

# Delete the deployed copy, which is everything it costs.
teardown:
    aws lightsail delete-container-service --service-name {{service}} --region {{region}}

# The read-only gate, the way CI runs it.
check:
    uv run ruff format --check orla tests
    uv run ruff check orla tests
    uv run ty check orla
    uv run pytest -q
    cd web && pnpm run check
