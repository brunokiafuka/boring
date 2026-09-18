/** What the customer feature exposes. Everything else in this folder is private to it. */
export { Customer, type CustomerRecord } from "./resource";
export { updateCustomer } from "./actions/update-customer";
export { customerRoutes } from "./routes";
