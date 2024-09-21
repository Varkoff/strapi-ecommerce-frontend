import qs from 'qs';
import { z } from 'zod';
import type { ChangePasswordSchema, ChangeUsernameSchema } from './routes/profile';
import type { RegisterSchema } from './routes/register';
import type { LoginSchema } from './routes/signin';
import { getUserToken, requireUser, serverEnv } from './sessions.server';

const productSchema = z.object({
    id: z.number(),
    documentId: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
    slug: z.string(),
    image: z.object({
        url: z.string(),
        alternativeText: z.string().optional(),
        width: z.number(),
        height: z.number(),
    }),
});

const getOrderSchema = z.object({
    id: z.number(),
    lines: z.array(
        z.object({
            produit: productSchema,
            quantity: z.number(),
            price: z.number(),
        })
    ),
    totalPrice: z.number(),
    orderStatus: z.string(),
    createdAt: z.string(),
    user: z.object({
        documentId: z.string(),
    }),
});

const getOrdersByUserIdSchema = z.array(z.object({
    documentId: z.string(),
    id: z.number(),
    // lines: z.array(
    //     z.object({
    //         produit: productSchema,
    //         quantity: z.number(),
    //         price: z.number(),
    //     })
    // ),
    totalPrice: z.number(),
    orderStatus: z.string(),
    createdAt: z.string(),
    // user: z.object({
    //     documentId: z.string(),
    // }),
}));

const productListSchema = z.object({
    data: z.array(productSchema),
});

const categoryListSchema = z.array(
    z.object({
        name: z.string(),
    })
);

export const fetchStrapi = async ({
    resourceName,
    sort = [],
    populate = [],
    fields = [],
    filters = {},
    pagination = {
        page: 1,
        pageSize: 100,
    },
    status = 'published',
    method = 'GET',
    body = {},
    type = 'content',
    headers = {},
}: {
    resourceName: string;
    sort?: string[];
    populate?: string[];
    fields?: string[];
    filters?: object;
    pagination?: {
        page: number;
        pageSize: number;
    };
    status?: 'draft' | 'published';
    method?: 'GET' | 'POST' | 'PUT';
    body?: object;
    type?: 'auth' | 'content';
    headers?: HeadersInit;
}) => {
    const urlParams = qs.stringify(
        {
            populate: populate,
            fields: fields,
            sort: sort,
            filters: filters,
            pagination: pagination,
            status,
        },
        {
            encodeValuesOnly: true,
        }
    );
    const response = await fetch(
        `http://localhost:1337/api/${resourceName}?${urlParams}`,
        {
            method,
            body:
                method !== 'GET'
                    ? JSON.stringify(
                        type === 'content'
                            ? {
                                data: body,
                            }
                            : body
                    )
                    : undefined,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serverEnv.STRAPI_TOKEN}`,
                ...headers,
            },
        }
    );

    if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to fetch from Strapi');
    }
    const jsonResponse = await response.json();
    return jsonResponse;
};

export const getProducts = async ({
    category = null,
    filters = {},
}: {
    category?: string | null;
    filters?: object;
}) => {
    if (category) {
        filters = {
            ...filters,
            categories: {
                name: {
                    $eqi: category,
                },
            },
        };
    }

    const jsonResponse = await fetchStrapi({
        resourceName: 'produits',
        sort: ['id:desc'],
        populate: ['image'],
        fields: ['name', 'slug', 'description', 'price', 'publishedAt'],
        filters,
    });
    const { data: products } = productListSchema.parse(jsonResponse);
    return products;
};

export const getCategories = async () => {
    const jsonResponse = await fetchStrapi({
        resourceName: 'categorie-de-produits',
        sort: ['id:desc'],
        fields: ['name'],
    });
    const categories = categoryListSchema.parse(jsonResponse.data);
    return categories;
};

export const getProductBySlug = async ({ slug }: { slug: string }) => {
    const jsonResponse = await fetchStrapi({
        resourceName: `produits/${slug}`,
    });
    const product = productSchema.parse(jsonResponse.data);
    return product;
};

export const getOrderById = async ({ id }: { id: string }) => {
    const jsonResponse = await fetchStrapi({
        resourceName: `commandes/${id}`,
        populate: ['lines', 'lines.produit', 'lines.produit.image', 'user'],
    });
    const order = getOrderSchema.parse(jsonResponse.data);
    return order;
};

export const getOrdersByUserId = async ({ userDocumentId }: { userDocumentId: string }) => {
    const jsonResponse = await fetchStrapi({
        resourceName: "commandes",
        fields: ['totalPrice', 'orderStatus', 'createdAt', 'id', 'documentId'],
        filters: {
            user: {
                documentId: userDocumentId
            }
        }
    });
    const orders = getOrdersByUserIdSchema.parse(jsonResponse.data);
    return orders;
};

export type OrderItem = { id: number; quantity: number; price: number };

const createOrderSchema = z.object({
    id: z.number(),
    documentId: z.string(),
});
export const createOrder = async ({
    products,
    email,
}: {
    products: OrderItem[];
    email: string;
}) => {
    const strapiUser = await getStrapiUser({ email });
    if (!strapiUser) {
        throw new Error('This account does not exist');
    }

    const orderItems = await Promise.all(
        products.map((product) =>
            createOrderItem({
                id: product.id,
                quantity: product.quantity,
                price: product.price,
            })
        )
    );
    const jsonResponse = await fetchStrapi({
        method: 'POST',
        resourceName: 'commandes',
        body: {
            user: strapiUser.documentId,
            lines: orderItems.map((o) => o.id),
            totalPrice: orderItems.reduce((acc, curr) => acc + curr.price, 0),
        },
    });
    const order = createOrderSchema.parse(jsonResponse.data);
    return order;
};

// export const attachCustomerToOrder = async ({ email, orderId }: {
//     email: string,
//     orderId: string;
// }) => {
//     const strapiUser = await getStrapiUser({ email })
//     if (!strapiUser) { throw new Error('This account does not exist') }

//     const jsonResponse = await fetchStrapi({
//         method: 'PUT',
//         resourceName: `commandes/${orderId}`,
//         body: {
//             user: strapiUser.documentId
//         },
//     });
//     const order = createOrderSchema.parse(jsonResponse.data);
//     return order;
// };

// api/ligne-de-commandes

const orderItemSchema = z.object({
    id: z.number(),
    price: z.number(),
});
export const createOrderItem = async ({ id, quantity, price }: OrderItem) => {
    const jsonResponse = await fetchStrapi({
        method: 'POST',
        resourceName: 'ligne-de-commandes',
        body: {
            quantity,
            produit: id,
            price: price * quantity,
        },
    });
    return orderItemSchema.parse(jsonResponse.data);
};

const authTokenSchema = z.object({
    jwt: z.string(),
});

export const registerUser = async ({
    registerData,
}: {
    registerData: z.infer<typeof RegisterSchema>;
}) => {
    const { email, username, password } = registerData;
    const jsonResponse = await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/local/register',
        body: {
            email,
            username,
            password,
        },
    });

    const authData = authTokenSchema.parse(jsonResponse);
    return authData;
};

export const logUser = async ({
    loginData,
}: {
    loginData: z.infer<typeof LoginSchema>;
}) => {
    const { email, password } = loginData;
    const jsonResponse = await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/local',
        body: {
            identifier: email,
            password,
        },
    });

    const authData = authTokenSchema.parse(jsonResponse);
    return authData;
};

const getUsersSchema = z.array(
    z.object({
        documentId: z.string(),
        email: z.string(),
        // username: z.string(),
    })
);

// Return true if user exists, false otherwise
export const checkIfUserExists = async ({ email }: { email: string }) => {
    const jsonResponse = await fetchStrapi({
        resourceName: 'users',
        fields: ['email', 'documentId'],
        filters: {
            email: {
                $eqi: email,
            },
        },
    });
    const users = getUsersSchema.parse(jsonResponse);
    return users.length > 0;
};

export const getStrapiUser = async ({ email }: { email: string }) => {
    const jsonResponse = await fetchStrapi({
        resourceName: 'users',
        fields: ['email', 'documentId'],
        filters: {
            email: {
                $eqi: email,
            },
        },
    });
    const users = getUsersSchema.parse(jsonResponse);
    return users[0];
};



export const forgotPassword = async ({
    email
}: {
    email: string;
}) => {
    await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/forgot-password',
        body: {
            email
        },
    });
};

export const resetPassword = async ({
    code,
    password,
    passwordConfirmation
}: {
    code: string;
    password: string;
    passwordConfirmation: string;
}) => {
    const jsonResponse = await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/reset-password',
        body: {
            code,
            password,
            passwordConfirmation
        },
    });
    return authTokenSchema.parse(jsonResponse)
};


export const changeUserPassword = async ({
    changeUserPasswordData: {
        currentPassword,
        password,
        passwordConfirmation,
    },
    request
}: {
    changeUserPasswordData: z.infer<typeof ChangePasswordSchema>
    request: Request
}) => {
    const userToken = await getUserToken({ request })
    const jsonResponse = await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/change-password',
        body: {
            currentPassword,
            password,
            passwordConfirmation
        },
        headers: {
            Authorization: `Bearer ${userToken}`
        }
    });
    return authTokenSchema.parse(jsonResponse)
};

const isUserPasswordValidSchema = z.object({
    isPasswordValid: z.boolean()
})
export const isUserPasswordValid = async ({
    currentPassword,
    email,
}: {
    currentPassword: string;
    email: string;
}) => {
    const jsonResponse = await fetchStrapi({
        type: 'auth',
        method: 'POST',
        resourceName: 'auth/compare-passwords',
        body: {
            currentPassword,
            email
        },
    });

    console.log({ jsonResponse })
    return isUserPasswordValidSchema.parse(jsonResponse)
};

export const changeUserDetails = async ({
    userData: {
        username
    },
    request
}: {
    userData: z.infer<typeof ChangeUsernameSchema>
    request: Request
}) => {
    const user = await requireUser({ request })
    await fetchStrapi({
        type: 'auth',
        method: 'PUT',
        resourceName: `users/${user.id}`,
        body: {
            username
        }
    });
};
