import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/sessions", "routes/api.sessions.tsx"),
  route("api/sessions/:id", "routes/api.sessions.$id.tsx"),
  route("api/sessions/:id/events", "routes/api.sessions.$id.events.tsx"),
  route("api/sessions/:id/stream", "routes/api.sessions.$id.stream.tsx"),
  route("s/:id", "routes/session.tsx"),
] satisfies RouteConfig;
