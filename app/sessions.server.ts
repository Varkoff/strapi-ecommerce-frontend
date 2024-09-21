import { createCookieSessionStorage, redirect } from "@remix-run/node"; // or cloudflare/deno
import { z } from "zod";
import { fetchStrapi } from "./strapi.server";

const envSchema = z.object({
    JWT_SECRET: z.string().min(4),
    STRAPI_TOKEN: z.string().min(4),
    STRAPI_URL: z.string().min(4)
});

export const serverEnv = envSchema.parse(process.env);


type SessionData = {
    strapi_user_token: string;
};

type SessionFlashData = {
    error: string;
};

const { getSession, commitSession, destroySession } =
    createCookieSessionStorage<SessionData, SessionFlashData>({
        // a Cookie from `createCookie` or the CookieOptions to create one
        cookie: {
            name: "__session",
            // all of these are optional
            // domain: "remix.run",
            // Expires can also be set (although maxAge overrides it when used in combination).
            // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
            //
            // expires: new Date(Date.now() + 60_000),
            httpOnly: true,
            // maxAge: 60,
            path: "/",
            sameSite: "lax",
            secrets: [serverEnv.JWT_SECRET],
            secure: process.env.NODE_ENV === "production",
        },
    });

export { commitSession, destroySession, getSession };

const STRAPI_SESSION_TOKEN = "strapi_user_token";

export const getUserToken = async ({ request }: { request: Request }) => {
    const session = await getSession(request.headers.get("Cookie"));
    return session.get(STRAPI_SESSION_TOKEN);
};

const strapiAuthenticatedUserSchema = z.object({
    email: z.string(),
    username: z.string(),
    id: z.number(),
    documentId: z.string(),
})
export const getUser = async ({ request }: {
    request: Request
}) => {
    const userToken = await getUserToken({
        request
    })
    if (!userToken) {
        return null;
    }

    const userData = await fetchStrapi({
        resourceName: 'users/me',
        headers: {
            Authorization: `Bearer ${userToken}`
        },
    })
    // console.log({ userData })

    return {
        ...strapiAuthenticatedUserSchema.parse(userData),
        token: userToken
    };
}

export const requireUser = async ({ request }:
    { request: Request }
) => {
    const optionalUser = await getUser({ request })
    if (!optionalUser) {
        throw redirect('/signin')
    }
    return optionalUser
}

export const createUserSession = async ({
    request,
    strapiUserToken,
    redirectTo = '/'
}: {
    request: Request; strapiUserToken: string,
    redirectTo?: string;

}) => {
    const session = await getSession(request.headers.get("Cookie"));
    session.set(STRAPI_SESSION_TOKEN, strapiUserToken);

    return redirect(redirectTo, {
        headers: {
            "Set-Cookie": await commitSession(session),
        },
    });
};

export const logout = async ({
    request,
    redirectTo = '/'
}: {
    request: Request;
    redirectTo?: string;

}) => {
    const session = await getSession(request.headers.get("Cookie"));
    return redirect(redirectTo, {
        headers: {
            "Set-Cookie": await destroySession(session),
        },
    });

}