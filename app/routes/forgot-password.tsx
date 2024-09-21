import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { getUser } from "~/sessions.server";
import { forgotPassword } from "~/strapi.server";

const ForgotPasswordSChema = z.object({
    email: z.string().email()
})

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const optionalUser = await getUser({ request })
    if (optionalUser) {
        return redirect('/')
    }
    return null;
}


export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const submission = parseWithZod(formData, {
        schema: ForgotPasswordSChema,
    });

    if (submission.status !== 'success') {
        return json({ result: submission.reply(), message: null });
    }


    await forgotPassword({
        email: submission.value.email
    })

    return json({ result: submission.reply(), message: "If you have an account in our database, we have sent you an email." });
};


export default function ForgotPassword() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';

    const [form, fields] = useForm({
        lastResult: actionData?.result,
        onValidate({ formData }) {
            return parseWithZod(formData, { schema: ForgotPasswordSChema });
        },
    });

    return (
        <div className='max-w-md mx-auto mt-8'>
            <h1 className='text-2xl font-bold mb-4'>Forgot Password</h1>
            <Form method='post' {...getFormProps(form)}>
                <fieldset>
                    <div className='mb-4'>
                        <label htmlFor='email' className='block mb-1'>
                            Email
                        </label>
                        <input
                            {...getInputProps(fields.email, { type: 'email' })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.email.errors && (
                            <p className='text-red-500 text-sm mt-1'>
                                {fields.email.errors}
                            </p>
                        )}
                    </div>
                    {actionData?.message ? <p className="text-green-500">{actionData?.message}</p> : null}
                    <button
                        type='submit'
                        disabled={isSubmitting}
                        className='w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-blue-300'
                    >
                        {isSubmitting ? 'Resetting...' : 'Reset password'}
                    </button>
                </fieldset>
            </Form>
            <p className='mt-4 text-center'>
                Remembered your password?{' '}
                <Link to='/login' className='text-blue-500 hover:underline'>
                    Log in
                </Link>
            </p>
        </div>
    )
}