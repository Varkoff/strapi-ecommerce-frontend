import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import {
  Form,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
  useLocation,
  useRouteLoaderData,
} from '@remix-run/react';
import { CartProvider, useCart } from './cart.context';
import { getUser, serverEnv } from './sessions.server';
import { getProducts } from './strapi.server';
import tailwindCss from './tailwind.css?url';

export const links: LinksFunction = () => {
  return [
    {
      rel: 'stylesheet',
      href: tailwindCss,
    },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [user, products] = await Promise.all([
    getUser({
      request,
    }),
    getProducts({ category: null }),
  ]);

  const { STRAPI_URL } = serverEnv
  return json({
    products, user, env: {
      STRAPI_URL
    }
  });
};

export const useProductsData = () => {
  const data = useRouteLoaderData<typeof loader>('root');
  if (data) {
    return data.products;
  }
  return [];
};

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>('root');
  if (data) {
    return data.user;
  }
  return null;
};

export const useEnv = () => {
  const data = useRouteLoaderData<typeof loader>('root');
  if (data) {
    return data.env;
  }
  return null;
};
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />
        <Links />
      </head>
      <body>
        <CartProvider>
          <Navbar />
          {children}
        </CartProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const Navbar = () => {
  const { calculatedPrice } = useCart();
  const optionalUser = useOptionalUser();
  const location = useLocation();
  // console.log(location)
  const urlPath = `${location.pathname}${location.search}`;
  const hasProductsInCart = calculatedPrice.products.length > 0;
  return (
    <nav className='w-full text-xs flex items-center gap-4 bg-zinc-100 px-3 py-2'>
      <Link to='/products' className='text-zinc-700'>
        Products
      </Link>
      {hasProductsInCart ? (
        <Link to='/cart' className='text-zinc-700'>
          Cart&nbsp;({calculatedPrice.totalPrice}€)
        </Link>
      ) : null}
      <div className='ml-auto gap-2 flex items-center'>
        {optionalUser ? (
          <>
            <Link to='/profile'>{optionalUser.username}</Link>
            <Link to='/history' className='text-zinc-700'>
              Historique de commandes
            </Link>
            <Form action='/logout' method='POST'>
              <button
                name='redirectTo'
                value={urlPath}
                className='text-gray-600'
                type='submit'
              >
                Se déconnecter
              </button>
            </Form>
          </>
        ) : (
          <Link to='/signin'>Se connecter</Link>
        )}
      </div>
    </nav>
  );
};

export default function App() {
  return <Outlet />;
}
