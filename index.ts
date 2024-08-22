import { Prisma } from "$/prisma/client/index.js";
import User from "../../modules/User/index.js";

import { FingerprintResult } from "express-fingerprint";

import * as prisma from "$/prisma/client/index.js";
import { Router } from "express";
import Modules from "../../modules/index.js";
import { surface_nested_type } from "../common/index.js";
const express = (await import("express")).default;

export type RequesterArgs = Prisma.Args<typeof User, "findFirst">;
export type RequesterFull = Prisma.Payload<typeof User, "findFirst">;
export type Requester = RequesterFull["scalars"] &
    prisma.Prisma.usersGetPayload<{
        include: {
            user_authorities: {
                where: {
                    deleted: false;
                };
                include: {
                    dynamic_authorities: {
                        where: {
                            deleted: false;
                        };
                        include: {
                            dynamic_authority_values: {
                                where: {
                                    deleted: false;
                                };
                            };
                        };
                    };
                };
            };
            authorization_profile: {
                include: {
                    profile_authorities: {
                        where: {
                            deleted: false;
                        };
                        include: {
                            dynamic_authorities: {
                                where: {
                                    deleted: false;
                                };
                                include: {
                                    dynamic_authority_values: {
                                        where: {
                                            deleted: false;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            customer: true;
        };
    }>;

export type Req = import("express").Request & {
    user: Requester;
    fingerprint?: {
        hash: string;
        sd: FingerprintResult;
    };
    Modules: typeof Modules;
    client: typeof Modules;
};
type ApiType = "Socket" | "Http";
export type R = {
    is_router: true;
    served_types: ApiType[];
    events: {
        [key: string]:
            | undefined
            | {
                  path: string;
                  handlers: HandlerFunction[];
              };
    };
    middlewares: HandlerFunction[];
    children: {
        [key: string]: { path: string | false; router: R };
    };
    directory_full_path?: string;
    route_full_path?: string;
} & {
    push_middlewarese: (...handler: Handler[]) => void;
    post: (path: string, ...handler: Array<Handler>) => any;
    get: (path: string, ...handler: Array<Handler>) => any;
    all: (path: string, ...handler: Array<Handler>) => any;
    put: (path: string, ...handler: Array<Handler>) => any;
    delete: (path: string, ...handler: Array<Handler>) => any;
    use: (path: string | Handler | R, ...handlers: (Handler | R)[]) => any;
    use_and_push_to_middlewares: (path: string | Handler | R, ...handlers: (Handler | R)[]) => any;
    __router: Router;
};

export type HandlerFunction = (request: Req, response: import("express").Response, next: import("express").NextFunction) => any;
type _Handler = Handler[];
type Handler = _Handler | HandlerFunction;
export type toBeOmitted = { Router: (typeof express)["Router"] };
export type ExpressInterface = (Omit<typeof express, "Router"> & {
    Router: () => R;
    __Router: (typeof express)["Router"];
}) &
    typeof express;

const express_interface: ExpressInterface = express as any;
express_interface();

type _UseProp = UseProp[];
type UseProp = _UseProp | (R | HandlerFunction);

type HttpMethodName = "post" | "get" | "delete" | "put" | "all";

const route_modifier = function (method_name: HttpMethodName, router_instance: R) {
    return (path: string, ...handlers: Handler[]) => {
        const surfaced_handlers = surface_nested_type<HandlerFunction>(handlers);

        // modify handlers to
        const modified_handlers: HandlerFunction[] = [];
        for (const handler of surfaced_handlers) {
            modified_handlers.push(async (request, response, next) => {
                try {
                    return await handler(request, response, next);
                } catch (error) {
                    next(error);
                }
            });
        }
        if (router_instance.served_types.includes("Socket")) {
            const found_event = router_instance.events[path];
            if (!found_event || method_name == "post") {
                router_instance.events[path] = {
                    path,
                    handlers: modified_handlers,
                };
            }
        }
        // call original method with args
        router_instance.__router[method_name](path, ...(modified_handlers as any));
    };
};

const use_modifier = function (router_instance: R, push_to_middlewares = false) {
    return (path: UseProp | string, ...handlers: UseProp[]) => {
        const surfaced_props = surface_nested_type(handlers);
        const modified_props: (HandlerFunction | R["__router"])[] = [];

        const first_item = path;
        let prefix: false | string = false;
        if (typeof first_item == "string") {
            prefix = first_item;
        } else {
            handlers.unshift(first_item);
        }

        for (const item of surfaced_props) {
            if (typeof item == "function") {
                push_to_middlewares && router_instance.middlewares.push(item);
                modified_props.push(item);
            } else {
                item.middlewares.unshift(...modified_props.filter((i) => typeof i === "function"));
                router_instance.children[prefix || "/"] = {
                    path: prefix,
                    router: item,
                };
                modified_props.push(item.__router);
            }
        }
        if (prefix) {
            router_instance.__router.use(prefix, modified_props as any);
        } else {
            router_instance.__router.use(modified_props as any);
        }
    };
};

express_interface.__Router = express_interface.Router;
const modify_router = () => {
    (express_interface as any).Router = function () {
        const __router = express_interface.__Router();
        const router: R = {
            children: {},
            served_types: ["Http", "Socket"],
            events: {},
            is_router: true,
            __router: __router,
            push_middlewarese(...handler) {
                const surfaced_handlers = surface_nested_type(handler);
                this.middlewares.push(...surfaced_handlers);
            },
            use_and_push_to_middlewares: () => {},
            all: () => {},
            post: () => {},
            delete: () => {},
            put: () => {},
            get: () => {},
            middlewares: [],
            use: () => {},
        };

        const methods: HttpMethodName[] = ["all", "put", "delete", "get", "post"];

        for (const method of methods) {
            router[method] = route_modifier(method, router);
        }
        router.use = use_modifier(router);
        router.use_and_push_to_middlewares = use_modifier(router, true);
        return router;
    };
};
modify_router();
export default express_interface;
