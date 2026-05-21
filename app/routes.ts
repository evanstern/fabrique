import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/sessions", "routes/api.sessions.tsx"),
  route("api/sessions/:id", "routes/api.sessions.$id.tsx"),
  route("api/sessions/:id/tick", "routes/api.sessions.$id.tick.tsx"),
  route("api/sessions/:id/thread", "routes/api.sessions.$id.thread.tsx"),
] satisfies RouteConfig;
