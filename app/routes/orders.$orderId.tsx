import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEnv } from "~/root";
import { logout, requireUser } from "~/sessions.server";
import { getOrderById } from "~/strapi.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { orderId } = params;
  if (!orderId) {
    throw new Error("Order Id is required");
  }

  const user = await requireUser({ request })
  const order = await getOrderById({
    id: orderId,
  });

  if (user.documentId !== order.user.documentId) {
    throw await logout({ request, redirectTo: '/signin' })
  }

  return order
};

export default function Index() {
  const { lines, id, orderStatus, createdAt, totalPrice } = useLoaderData<typeof loader>();
  return (
    <div className="flex gap-4 max-w-[1280px] mx-auto flex-col px-12 py-6">
      <div className="flex flex-col">
        <h1 className="text-3xl mb-4">Commande #{id}</h1>
        <span>
          {new Date(createdAt).toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="text-gray-600">{orderStatus}</span>
      </div>
      {lines.map((line) => (
        <LineItem line={line} key={line.produit.name} />
      ))}
      <div className="pt-4 text-right">
        <span className="text-xl font-bold">
          Total Price: {totalPrice}€
        </span>
      </div>
    </div>
  );
}
const LineItem = ({
  line
}: {
  line: Awaited<ReturnType<typeof getOrderById>>['lines'][0]
}) => {
  const { STRAPI_URL } = useEnv() || {}


  return (
    <div className="border-b border-gray-200 pb-4">
      <div className="flex items-center gap-2 w-full">
        <div className="flex flex-col items-start">
          <h3 className="text-lg font-semibold">{line.produit.name}</h3>
          <img
            src={
              line.produit.image.url.startsWith("/")
                ? `${STRAPI_URL}${line.produit.image.url}`
                : line.produit.image.url
            }
            alt={line.produit.image.alternativeText}
            className="size-16 object-cover"
          />
        </div>
        <div className="ml-auto flex flex-col items-start">
          <span className="text-gray-600">
            Quantity: {line.quantity}
          </span>
        </div>
      </div>
      <div className="mt-2 flex justify-between items-center">
        <span className="text-gray-600">
          Price per item: {line.produit.price}€
        </span>
        <span className="font-bold">Total: {line.price}€</span>
      </div>
    </div>
  );
};