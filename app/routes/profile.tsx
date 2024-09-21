import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, json, useActionData, useNavigation } from '@remix-run/react';
import { z } from 'zod';
import { useOptionalUser } from '~/root';
import { requireUser } from '~/sessions.server';
import { changeUserDetails, changeUserPassword, isUserPasswordValid } from '~/strapi.server';

export const ChangePasswordSchema = z.object({
    type: z.literal('change-password'),
    currentPassword: z.string().min(8),
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8),
});

export const ChangeUsernameSchema = z.object({
    type: z.literal('change-username'),
    username: z.string().min(3),
});

export const ChangeProfileSchema = z.discriminatedUnion('type', [
    ChangeUsernameSchema,
    ChangePasswordSchema,
]);

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await requireUser({ request });
    return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const user = await requireUser({ request });
    const submission = await parseWithZod(formData, {
        async: true,
        schema: ChangeProfileSchema.superRefine(async (data, ctx) => {
            if (data.type === 'change-password') {
                const { password, passwordConfirmation, currentPassword } = data;
                if (password !== passwordConfirmation) {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Passwords do not match',
                        path: ['password'],
                    });
                    return false;
                }
                const { isPasswordValid } = await isUserPasswordValid({
                    currentPassword,
                    email: user.email,
                });

                if (!isPasswordValid) {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Current password is invalid.',
                        path: ['currentPassword'],
                    });
                    return false;
                }

                if (password === currentPassword) {
                    ctx.addIssue({
                        code: 'custom',
                        message:
                            'Your new password should not be equal to your old password',
                        path: ['password'],
                    });
                    return false;
                }
            }
        }),
    });

    if (submission.status !== 'success') {
        return json({ result: submission.reply(), message: null });
    }

    const data = submission.value;
    switch (data.type) {
        case "change-password": {
            await changeUserPassword({
                changeUserPasswordData: data,
                request,
            });
            return json({
                message: 'You have successfully changed your password !',
                result: submission.reply({
                    resetForm: true,
                }),
            });
        }
        case "change-username": {
            await changeUserDetails({
                userData: data,
                request,
            });
            return json({
                message: 'You have successfully changed your username !',
                result: submission.reply(),
            });
        }
        default: {
            return json({ result: submission.reply(), message: null });
        }
    }

};

export default function UserSettings() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';
    const user = useOptionalUser();

    const [form, fields] = useForm({
        lastResult: actionData?.result,
        onValidate({ formData }) {
            return parseWithZod(formData, { schema: ChangeProfileSchema });
        },
        defaultValue: {
            username: user?.username,
        },
    });

    return (
        <div className='max-w-md mx-auto mt-8'>
            <h1 className='text-2xl font-bold mb-4'>Profile</h1>
            <Form method='post' {...getFormProps(form)}>
                <fieldset>
                    <div className='mb-4'>
                        <label htmlFor='username' className='block mb-1'>
                            Username
                        </label>
                        <input
                            {...getInputProps(fields.username, { type: 'text' })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.username.errors && (
                            <p className='text-red-500 text-sm mt-1'>
                                {fields.username.errors}
                            </p>
                        )}
                    </div>
                    <button
                        type='submit'
                        name='type'
                        value='change-username'
                        disabled={isSubmitting}
                        className='w-full bg-emerald-500 text-white py-2 rounded hover:bg-emerald-600 disabled:bg-emerald-300'
                    >
                        {isSubmitting ? 'Changing...' : 'Change Username'}
                    </button>
                    <hr className='my-12' />
                    <div className='mb-4'>
                        <label htmlFor='currentPassword' className='block mb-1'>
                            Current Password
                        </label>
                        <input
                            {...getInputProps(fields.currentPassword, { type: 'password' })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.currentPassword.errors && (
                            <p className='text-red-500 text-sm mt-1'>
                                {fields.currentPassword.errors}
                            </p>
                        )}
                    </div>
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
                        <label htmlFor='password' className='block mb-1'>
                            Password Confirmation
                        </label>
                        <input
                            {...getInputProps(fields.passwordConfirmation, {
                                type: 'password',
                            })}
                            className='w-full px-3 py-2 border rounded'
                        />
                        {fields.passwordConfirmation.errors && (
                            <p className='text-red-500 text-sm mt-1'>
                                {fields.passwordConfirmation.errors}
                            </p>
                        )}
                    </div>
                    {actionData?.message ? <p>{actionData.message}</p> : null}
                    <button
                        type='submit'
                        name='type'
                        value='change-password'
                        disabled={isSubmitting}
                        className='w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-blue-300'
                    >
                        {isSubmitting ? 'Changing...' : 'Change Password'}
                    </button>
                </fieldset>
            </Form>
        </div>
    );
}
