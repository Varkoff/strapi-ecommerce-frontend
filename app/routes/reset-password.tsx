import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { createUserSession, getUser } from "~/sessions.server";
import { resetPassword } from "~/strapi.server";

const ResetPasswordSChema = z.object({
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8)
})

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const optionalUser = await getUser({ request })
    if (optionalUser) {
        return redirect('/')
    }
    const urlParams = new URL(request.url).searchParams
    const code = urlParams.get('code') as string || null;
    if (!code) {
        return redirect('/')
    }
    console.log({ code })
    // 
    return null;
}


export const action = async ({ request }: ActionFunctionArgs) => {
    const urlParams = new URL(request.url).searchParams
    const code = urlParams.get('code') as string || null;
    if (!code) {
        return redirect('/')
    }
    const formData = await request.formData();
    const submission = await parseWithZod(formData, {
        async: true,
        schema: ResetPasswordSChema.superRefine((data, ctx) => {
            const { password, passwordConfirmation } = data
            if (password !== passwordConfirmation) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Passwords do not match',
                    path: ['password'],
                });
            }
        }),
    });

    if (submission.status !== 'success') {
        return json({ result: submission.reply() });
    }


    const { jwt } = await resetPassword({
        code,
        password: submission.value.password,
        passwordConfirmation: submission.value.passwordConfirmation
    })

    return await createUserSession({
        request,
        strapiUserToken: jwt,
    });
};


export default function ResetPassword() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';

    const [form, fields] = useForm({
        lastResult: actionData?.result,
        onValidate({ formData }) {
            return parseWithZod(formData, { schema: ResetPasswordSChema });
        },
    });

    return (
        <div className='max-w-md mx-auto mt-8'>
            <h1 className='text-2xl font-bold mb-4'>Reset Password</h1>
            <Form method='post' {...getFormProps(form)}>
                <fieldset>
                    <div className='mb-4'>
                        <label htmlFor='password' className='block mb-1'>
                            Password
                        </label>
                        <input
                            {...getInputProps(fields.password, { type: 'password' })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.password.errors && (
                            <p className='text-red-500 text-sm mt-1'>
                                {fields.password.errors}
                            </p>
                        )}
                    </div>
                    <div className='mb-4'>
                        <label htmlFor='passwordConfirmation' className='block mb-1'>
                            Password Confirmation
                        </label>
                        <input
                            {...getInputProps(fields.passwordConfirmation, { type: 'password' })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.passwordConfirmation.errors && (
                            <p className='text-red-500 text-sm mt-1'>{fields.passwordConfirmation.errors}</p>
                        )}
                    </div>
                    <button
                        type='submit'
                        disabled={isSubmitting}
                        className='w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-blue-300'
                    >
                        {isSubmitting ? 'Changing password...' : 'Change password'}
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