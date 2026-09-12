# Node builds the canvas and Python serves it, so the image is built in two
# stages and only the Python runtime is shipped.

FROM node:24-slim AS web

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

WORKDIR /web
# The manifest and the lockfile come first so a source edit does not reinstall
# the dependency tree.
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build


FROM python:3.13-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.10.5 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY orla/ ./orla/
COPY --from=web /web/dist ./orla/static
RUN uv sync --frozen --no-dev

# Binding to the loopback address serves nobody outside the container, and
# the workspace sits on its own path so a volume can be mounted over it.
ENV PATH="/app/.venv/bin:$PATH" \
    ORLA_HOST=0.0.0.0 \
    ORLA_WORKSPACE=/data/workspace

RUN useradd --create-home --uid 10001 orla && mkdir -p /data && chown -R orla /data /app
USER orla

EXPOSE 8000
CMD ["orla", "serve"]
