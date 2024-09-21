import { createContext, useContext, useMemo } from 'react';
import type { getProducts } from './strapi.server';
import { useLocalStorage } from './useLocalStorage';

export type CartItemType = {
    documentId: string;
    quantity: number;
    pricePerItem: number;
};

type CartContextType = {
    cartItems: CartItemType[];
    addToCart: ({ product }: { product: Awaited<ReturnType<typeof getProducts>>['0'] }) => void;
    removeFromCart: ({ product }: { product: Awaited<ReturnType<typeof getProducts>>['0'] }) => void;
    clearCart: () => void;
    calculatedPrice: {
        products: ProductWithPrice[];
        totalPrice: number
    };
};

export type ProductWithPrice = CartItemType & {
    totalPrice: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [cartItems, setCartItems] = useLocalStorage<CartItemType[]>("cart", []);


    const addToCart = ({ product }: { product: Awaited<ReturnType<typeof getProducts>>['0'] }) => {
        setCartItems((prevItems) => {
            const existingItem = prevItems.find((item) => item.documentId === product.documentId);
            if (existingItem) {
                return prevItems.map((item) =>
                    item.documentId === product.documentId ? {
                        ...item, quantity: item.quantity + 1
                    } : item
                );
            }
            console.log({ product })
            return [...prevItems, { documentId: product.documentId, quantity: 1, pricePerItem: product.price }];
        });
    };

    const removeFromCart = ({ product }: { product: Awaited<ReturnType<typeof getProducts>>['0'] }) => {
        setCartItems((prevItems) => {
            const existingItem = prevItems.find((item) => item.documentId === product.documentId);
            if (existingItem && existingItem.quantity > 1) {
                return prevItems.map((item) =>
                    item.documentId === product.documentId ? { ...item, quantity: item.quantity - 1 } : item
                );
            }
            return prevItems.filter((item) => item.documentId !== product.documentId);
        });
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const calculatedPrice = useMemo((): {
        products: ProductWithPrice[];
        totalPrice: number;
    } => {

        const calculatedProducts: ProductWithPrice[] = cartItems.map((product) => {
            const cartItem = cartItems.find((item) => item.documentId === product.documentId);
            const newProduct: ProductWithPrice = {
                ...product,
                quantity: cartItem?.quantity || 0,
                totalPrice: (cartItem?.pricePerItem || 0) * (cartItem?.quantity || 0),

            }
            return newProduct
        });

        const totalPrice = calculatedProducts.reduce((sum, product) => sum + product.totalPrice, 0);

        return { products: calculatedProducts, totalPrice };
    }, [cartItems]);

    return (
        <CartContext.Provider
            value={{ cartItems, addToCart, removeFromCart, clearCart, calculatedPrice }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};