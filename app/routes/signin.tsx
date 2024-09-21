import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, json, useActionData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { createUserSession } from "~/sessions.server";
import { checkIfUserExists, isUserPasswordValid, logUser } from "~/strapi.server";

export const LoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});







export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const submission = await parseWithZod(formData, {
        async: true,
        schema: LoginSchema.superRefine(async (data, ctx) => {
            const userExists = await checkIfUserExists({ email: data.email })
            if (!userExists) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'User does not exist.',
                    path: ['email'],
                })
            }
            const { isPasswordValid } = await isUserPasswordValid({
                currentPassword: data.password,
                email: data.email,
            });

            if (!isPasswordValid) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Your password is not valid.',
                    path: ['password'],
                });
                return false;
            }
        })
    });

    if (submission.status !== "success") {
        return json({ result: submission.reply() });
    }


    const { jwt } = await logUser({ loginData: submission.value })
    return await createUserSession({
        request,
        strapiUserToken: jwt,
    });
};

export default function Login() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const [form, fields] = useForm({
        lastResult: actionData?.result,
        onValidate({ formData }) {
            return parseWithZod(formData, { schema: LoginSchema });
        },
    });

    return (
        <div className="max-w-md mx-auto mt-8">
            <h1 className="text-2xl font-bold mb-4">Login</h1>
            <Form method="post" {...getFormProps(form)}>
                <fieldset >
                    <div className="mb-4">
                        <label htmlFor="email" className="block mb-1">Email</label>
                        <input
                            {...getInputProps(fields.email, { type: "email" })}
                            className="w-full px-3 py-2 border rounded"
                        />
                        {fields.email.errors && (
                            <p className="text-red-500 text-sm mt-1">{fields.email.errors}</p>
                        )}
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block mb-1">Password</label>
                        <input
                            {...getInputProps(fields.password, { type: "password" })}
                            className="w-full px-3 py-2 border rounded"
                        />
                        {fields.password.errors && (
                            <p className="text-red-500 text-sm mt-1">{fields.password.errors}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                    >
                        {isSubmitting ? "Login in..." : "Login"}
                    </button>
                </fieldset>
            </Form>
            <p className="mt-4 text-center">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="text-blue-500 hover:underline">
                    Register
                </Link>
            </p>
            <p className="mt-4 text-center">
                Forgot password ?{" "}
                <Link to="/forgot-password" className="text-blue-500 hover:underline">
                    Reset password
                </Link>
            </p>
        </div>
    );
}
