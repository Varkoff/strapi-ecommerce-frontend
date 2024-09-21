import type { ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/sessions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const redirectTo = formData.get('redirectTo') as string || '/'
    return await logout({
        request,
        redirectTo
    });
};