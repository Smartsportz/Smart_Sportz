from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

_request_count: dict[tuple[str, str, int], int] = defaultdict(int)
_request_latency_sum: dict[tuple[str, str], float] = defaultdict(float)
_request_latency_count: dict[tuple[str, str], int] = defaultdict(int)
_websocket_connections: dict[str, int] = defaultdict(int)
_worker_jobs: dict[tuple[str, str], int] = defaultdict(int)
_worker_queue_depth = 0


def _route_label(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return str(path or request.url.path)


async def metrics_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    route = _route_label(request)
    method = request.method
    _request_count[(method, route, response.status_code)] += 1
    _request_latency_sum[(method, route)] += elapsed
    _request_latency_count[(method, route)] += 1
    response.headers["X-Response-Time-Ms"] = f"{elapsed * 1000:.2f}"
    return response


def websocket_connected(channel: str) -> None:
    _websocket_connections[channel] += 1


def websocket_disconnected(channel: str) -> None:
    _websocket_connections[channel] = max(0, _websocket_connections[channel] - 1)


def worker_job_recorded(job_type: str, status: str) -> None:
    _worker_jobs[(job_type, status)] += 1


def set_worker_queue_depth(depth: int) -> None:
    global _worker_queue_depth
    _worker_queue_depth = max(0, int(depth))


def prometheus_text() -> str:
    lines = [
        "# HELP smart_sportz_http_requests_total Total HTTP requests.",
        "# TYPE smart_sportz_http_requests_total counter",
    ]
    for (method, route, status_code), count in sorted(_request_count.items()):
        lines.append(f'smart_sportz_http_requests_total{{method="{method}",route="{route}",status="{status_code}"}} {count}')
    lines.extend([
        "# HELP smart_sportz_http_request_duration_seconds_sum Total HTTP request duration.",
        "# TYPE smart_sportz_http_request_duration_seconds_sum counter",
    ])
    for (method, route), total in sorted(_request_latency_sum.items()):
        lines.append(f'smart_sportz_http_request_duration_seconds_sum{{method="{method}",route="{route}"}} {total:.6f}')
    lines.extend([
        "# HELP smart_sportz_http_request_duration_seconds_count HTTP request duration observations.",
        "# TYPE smart_sportz_http_request_duration_seconds_count counter",
    ])
    for (method, route), count in sorted(_request_latency_count.items()):
        lines.append(f'smart_sportz_http_request_duration_seconds_count{{method="{method}",route="{route}"}} {count}')
    lines.extend([
        "# HELP smart_sportz_websocket_connections Active WebSocket connections.",
        "# TYPE smart_sportz_websocket_connections gauge",
    ])
    for channel, count in sorted(_websocket_connections.items()):
        lines.append(f'smart_sportz_websocket_connections{{channel="{channel}"}} {count}')
    lines.extend([
        "# HELP smart_sportz_worker_jobs_total Worker jobs by type and status.",
        "# TYPE smart_sportz_worker_jobs_total counter",
    ])
    for (job_type, status), count in sorted(_worker_jobs.items()):
        lines.append(f'smart_sportz_worker_jobs_total{{job_type="{job_type}",status="{status}"}} {count}')
    lines.extend([
        "# HELP smart_sportz_worker_queue_depth Current background job queue depth.",
        "# TYPE smart_sportz_worker_queue_depth gauge",
        f"smart_sportz_worker_queue_depth {_worker_queue_depth}",
        "",
    ])
    return "\n".join(lines)
