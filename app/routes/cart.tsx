import {
    type FieldMetadata,
    type FormMetadata,
    getFieldsetProps,
    getFormProps,
    getInputProps,
    useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { createId } from "@paralleldrive/cuid2";
import type { ActionFunctionArgs } from "@remix-run/node";
import {
    Form,
    Link,
    json,
    redirect,
    useActionData,
    useNavigation
} from "@remix-run/react";
import { useEffect } from "react";
import { z } from "zod";
import { useCart } from "~/cart.context";
import { useOptionalUser, useProductsData } from "~/root";
import { createUserSession, getUser } from "~/sessions.server";
import { SocketProvider, useSocket } from "~/socket.context";
import {
    type OrderItem,
    checkIfUserExists,
    createOrder,
    getProducts,
    registerUser,
} from "~/strapi.server";

const OrderProductSchema = z.object({
    documentId: z.string({
        required_error: "Product documentId is required",
    }),
    quantity: z.number({
        required_error: "Quantity is required",
    }),
});

const LoggedInOrderFormSchema = z.object({
    products: z.array(OrderProductSchema),
    status: z.literal("logged-in"),
});

const LoggedOutOrderFormSchema = z.object({
    products: z.array(OrderProductSchema),
    status: z.literal("logged-out"),
    email: z.string().email(),
});

const OrderFormSchema = z.discriminatedUnion("status", [
    LoggedInOrderFormSchema,
    LoggedOutOrderFormSchema,
]);

// import { io } from "socket.io-client";

// const socket = io("ws://example.com/my-namespace", {
//   reconnectionDelayMax: 10000,
//   auth: {
//     token: "123"
//   },
//   query: {
//     "my-key": "my-value"
//   }
// });
export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const optionalUser = await getUser({ request });

    // Valide les produits dans le formulaire avec la quantité et l'id
    const submission = await parseWithZod(formData, {
        async: true,
        schema: OrderFormSchema.superRefine(async (data, ctx) => {
            if (data.status === "logged-in") {
                if (!optionalUser) {
                    ctx.addIssue({
                        code: "custom",
                        message: "Please log in before placing your order",
                        path: ["email"],
                    });
                    return false;
                }
            }

            // Si l'utilisateur est déconnecté, et que l'email associé à sa commande
            // existe déjà, dans ce cas là on lui demande de se connecter à son compte
            // avant de passer commande
            if (data.status === "logged-out") {
                const userExists = await checkIfUserExists({ email: data.email });
                if (userExists) {
                    ctx.addIssue({
                        code: "custom",
                        message:
                            "User already exists. Please log in to order with this email.",
                        path: ["email"],
                    });
                }
                return false;
            }
        }),
    });

    // Si le formulaire n'a pas été validé côté serveur,
    // on renvoie les erreurs côté client pour les afficher
    if (submission.status !== "success") {
        return json({
            result: submission.reply(),
        });
    }
    const { products } = submission.value;
    const orderedProductDocumentIds = products.map((p) => p.documentId);

    const orderedProducts = await getProducts({
        filters: {
            documentId: {
                $in: orderedProductDocumentIds,
            },
        },
    });

    // On récupère les informations des produits, comme son prix dans la base de donnée
    // de strapi, et on récupère la quantité côté client
    const mergedProducts: OrderItem[] = products.map((p) => {
        const orderedProduct = orderedProducts.find(
            (op) => op.documentId === p.documentId,
        );
        if (!orderedProduct) {
            throw new Error("Product was not found");
        }
        return {
            quantity: p.quantity,
            id: orderedProduct.id,
            price: orderedProduct.price,
        };
    });

    let userToken = "";

    // Si l'utilisateur n'existe pas, alors on créé un compte pour pouvoir l'associer à sa commande.
    if (submission.value.status === "logged-out") {
        const password = createId();
        const { jwt } = await registerUser({
            registerData: {
                email: submission.value.email,
                password,
                username: submission.value.email,
            },
        });

        userToken = jwt;
    }

    const email =
        submission.value.status === "logged-out"
            ? submission.value.email
            : optionalUser?.email;

    if (!email) {
        throw new Error("Please provide a valid email");
    }

    // On créée ensuite la commande avec le compte utilisateur associé
    await createOrder({
        products: mergedProducts,
        email,
    });

    // Ajouter toute la logique de Stripe

    if (!optionalUser) {
        return await createUserSession({
            request,
            strapiUserToken: userToken,
            redirectTo: "/cart",
            // redirectTo: `/orders/${order.documentId}`,
        });
    }

    return redirect("/cart");
    // return redirect(`/orders/${order.documentId}`);
};

export default function CartWithProvider() {
    return (
        <SocketProvider>
            <Cart />
        </SocketProvider>
    );
}
export function Cart() {
    const { socket } = useSocket()
    const { calculatedPrice, clearCart } = useCart();

    useEffect(() => {
        if (!socket) return;
        if (typeof window === 'undefined') return;
        socket.on('checkout', (sessionUrl: string) => {
            clearCart();
            window.location.href = sessionUrl
        })
    }, [socket, clearCart])
    const actionData = useActionData<typeof action>();
    const products = useProductsData();
    const [form, fields] = useForm({
        lastResult: actionData?.result,
        constraint: getZodConstraint(OrderFormSchema),
        onValidate({ formData }) {
            const parsed = parseWithZod(formData, {
                schema: OrderFormSchema,
            });

            // if (parsed.status === 'success') {
            //     clearCart()
            // }
            return parsed;
        },
        defaultValue: {
            products: calculatedPrice.products.map((p) => ({
                documentId: p.documentId,
                quantity: p.quantity,
            })),
        },
    });
    const productsList = fields.products.getFieldList();
    const navigation = useNavigation();
    const isLoading = navigation.state !== "idle";
    const optionalUser = useOptionalUser();

    if (calculatedPrice.products.length === 0) {
        return (
            <div className="flex flex-col gap-3 max-w-[1280px] mx-auto px-12 py-6">
                <span className="font-thin">No products in cart</span>
                <Link to="/products" className="bg-black text-white px-2 py-1 w-fit">
                    Check latest products
                </Link>
            </div>
        );
    }
    return (
        <Form {...getFormProps(form)} method="POST">
            <div className="flex gap-4 max-w-[1280px] mx-auto flex-col px-12 py-6">
                {productsList.map((product, index) => (
                    <CartItem
                        form={form}
                        product={product}
                        key={product.key}
                        products={products}
                        index={index}
                    />
                ))}
                <div className="pt-4 text-right">
                    <span className="text-xl font-bold">
                        Total Cart Value: {calculatedPrice.totalPrice}€
                    </span>
                </div>
                {optionalUser ? null : (
                    <div className="mb-4">
                        <label htmlFor="email" className="block mb-1">
                            Email
                        </label>
                        <input
                            {...getInputProps(fields.email, { type: "email" })}
                            className="w-full px-3 py-2 border rounded"
                        />
                        {fields.email.errors && (
                            <p className="text-red-500 text-sm mt-1">{fields.email.errors}</p>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-4 justify-between">
                    <button
                        onClick={() => {
                            clearCart();
                        }}
                        type="button"
                        className="bg-slate-100 text-black border-slate-200 border px-2 py-1 w-fit"
                    >
                        Clear Cart
                    </button>

                    <button
                        type="submit"
                        disabled={isLoading}
                        name="status"
                        value={optionalUser ? "logged-in" : "logged-out"}
                        className="bg-black disabled:cursor-progress disabled:opacity-50 text-white px-2 py-1 w-fit"
                    >
                        Order now
                    </button>
                </div>
            </div>
        </Form>
    );
}

const CartItem = ({
    products,
    product,
    form,
    index,
}: {
    products: Awaited<ReturnType<typeof getProducts>>;
    product: FieldMetadata<z.infer<typeof OrderProductSchema>>;
    form: FormMetadata<z.infer<typeof OrderFormSchema>>;
    index: number;
}) => {
    const { addToCart, removeFromCart, calculatedPrice } = useCart();
    const { documentId, quantity } = product.getFieldset();
    const fieldsetProps = getFieldsetProps(product);

    const selectedProduct = products.find(
        (p) => p.documentId === documentId.value,
    );
    const productInCart = calculatedPrice.products.find(
        (p) => p.documentId === documentId.value,
    );
    if (!selectedProduct) return null;
    if (!productInCart) return null;

    const fields = form.getFieldset();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { defaultValue, ...cartItemProps } = getInputProps(quantity, {
        type: "hidden",
    })

    return (
        <fieldset {...fieldsetProps} className="border-b border-gray-200 pb-4">
            <div className="flex items-center gap-2 w-full">
                <div className="flex flex-col items-start">
                    <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                    <img
                        src={
                            selectedProduct.image.url.startsWith("/")
                                ? `http://localhost:1337${selectedProduct.image.url}`
                                : selectedProduct.image.url
                        }
                        alt={selectedProduct.image.alternativeText}
                        className="size-16 object-cover"
                    />
                </div>
                <div className="ml-auto flex flex-col items-start">
                    <span className="text-gray-600">
                        Quantity: {productInCart.quantity}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            className="bg-slate-700 text-white size-6 shrink-0"
                            type="button"
                            onClick={() => {
                                if (productInCart.quantity === 1) {
                                    form.remove({
                                        index: index,
                                        name: fields.products.name,
                                    });
                                }

                                removeFromCart({ product: selectedProduct });
                            }}
                        >
                            -
                        </button>
                        <button
                            className="bg-slate-700 text-white size-6 shrink-0"
                            type="button"
                            onClick={() => addToCart({ product: selectedProduct })}
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
            <div className="mt-2 flex justify-between items-center">
                <span className="text-gray-600">
                    Price per item: {productInCart.pricePerItem}€
                </span>
                <span className="font-bold">Total: {productInCart.totalPrice}€</span>
            </div>
            <input
                className="border border-gray-200"
                {...getInputProps(documentId, {
                    type: "hidden",
                })}
            />
            <input
                className="border border-gray-200"
                {...cartItemProps}
                value={productInCart?.quantity}
            />
        </fieldset>
    );
};
