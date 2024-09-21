import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/sessions.server";
import { getOrdersByUserId } from "~/strapi.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const user = await requireUser({ request })
    const orders = await getOrdersByUserId({
        userDocumentId: user.documentId
    });

    return orders
};


export default function Orders() {
    const orders = useLoaderData<typeof loader>();

    return (
        <div className="flex flex-col gap-4 max-w-[1280px] mx-auto px-12 py-6">
            <h1 className="text-3xl mb-4">Your Orders</h1>
            {orders.length === 0 ? (
                <span className="font-thin">No orders found</span>
            ) : (
                orders.map((order) => (
                    <Link to={`/orders/${order.documentId}`} key={order.documentId} className="group flex flex-col gap-1 border-b border-gray-200 pb-4">
                        <h2 className="group-hover:text-sky-600 text-lg font-semibold">Order #{order.id}</h2>
                        <div className="flex items-center gap-2">

                            <span className="text-gray-900 font-medium">{order.totalPrice}€</span>
                            <span className=" text-gray-100 text-xs bg-gray-700 w-fit px-2 py-1 rounded-full">{order.orderStatus}</span>
                        </div>
                        <span className="text-gray-600">
                            Commandée le {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            }
                            )}
                        </span>
                    </Link>
                ))
            )}
        </div>
    );
}