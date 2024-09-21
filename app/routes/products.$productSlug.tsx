import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useCart } from '~/cart.context';
import { getProductBySlug } from "~/strapi.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { productSlug } = params;
  if (!productSlug) {
    throw new Error("Product slug is required");
  }

  const product = await getProductBySlug({
    slug: productSlug,
  });

  return product
};

export const meta: MetaFunction<typeof loader> = ({
  data
}) => {
  return [
    { title: data?.name },
    { name: "description", content: `${data?.description} - ${data?.price}€` },
    {
      property: "og:image",
      content: data?.image.url.startsWith("/")
        ? `http://localhost:1337${data.image.url}`
        : data?.image.url
    }
  ];
};

export default function Index() {
  const product = useLoaderData<typeof loader>();
  const { addToCart, cartItems } = useCart();

  return (
    <div className="font-sans p-4 flex flex-col">

      <h1 className="text-3xl">{product.name}</h1>

      {product.image ? (
        <img
          src={
            product.image.url.startsWith("/")
              ? `http://localhost:1337${product.image.url}`
              : product.image.url
          }
          alt={product.image?.alternativeText}
          className="w-full h-auto max-w-[300px] object-cover"
        />
      ) : null}
      <p className="text-xs text-gray-600">{product.description}</p>
      <p className="font-bold grow mt-auto">{product.price}€</p>
      <div>

        <span className="p-2">{cartItems.find((item) => item.documentId === product.documentId)?.quantity || 0}</span>
        <button
          type='button'
          onClick={() => addToCart({ product })}
          className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}