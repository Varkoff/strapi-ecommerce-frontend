import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, type MetaFunction, useLoaderData, useSearchParams } from '@remix-run/react';
import { getCategories, getProducts } from '~/strapi.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const urlParams = new URL(request.url).searchParams;
  const category = urlParams.get('category');
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ category }),
  ]);
  return {
    products,
    categories,
  };
};
export const meta: MetaFunction = () => {
  return [
    { title: "Liste de produits" },
    { name: "description", content: "Bienvenue sur notre boutique en ligne" },
  ];
};

export default function Index() {
  const { products, categories } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <div className='font-sans p-4'>
      <h1 className='text-3xl'>Ecommerce</h1>
      <div className='flex items-center flex-wrap overflow-x-auto gap-2 py-6'>
        <button
          onClick={() => {
            setSearchParams((oldSearchParams) => {
              oldSearchParams.delete('category');
              return oldSearchParams;
            });
          }}
          type='button'
          className={`text-gray-500 ${!searchParams.has('category') ? 'text-gray-800' : ''
            }`}
        >
          Tous les produits
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => {
              setSearchParams((oldSearchParams) => {
                oldSearchParams.set('category', cat.name);
                return oldSearchParams;
              });
            }}
            type='button'
            className={`text-gray-500 ${searchParams.get('category') === cat.name ? 'text-gray-800' : ''
              }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className='flex flex-row flex-wrap gap-3'>
        {products.map((product) => {
          return (
            <Link
              to={`/products/${product.slug}`}
              className='self-stretch flex flex-col gap-2 h-full basis-[200px] px-2 py-1 bg-slate-100 hover:bg-slate-200'
              key={product.id}
            >
              <h2>{product.name}</h2>
              {product.image ? (
                <img
                  src={
                    product.image.url.startsWith('/')
                      ? `http://localhost:1337${product.image.url}`
                      : product.image.url
                  }
                  alt={product.image?.alternativeText}
                  className='h-32 w-full object-cover'
                />
              ) : null}
              <p className='text-xs text-gray-600'>{product.description}</p>
              <p className='font-bold grow mt-auto'>{product.price}€</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
