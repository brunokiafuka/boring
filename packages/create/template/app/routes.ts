import { mount, routes } from "@boring-dev/core";
import { homeRoutes } from "@/features/home";

/** Every URL in the application, in one place. Features own what is under their mount. */
export default routes([mount("/", homeRoutes)]);
