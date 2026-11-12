import api from "../netlify/functions/api.mjs";

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return api(request);
    }
    return env.ASSETS.fetch(request);
  }
};
