import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export type Product = {
  id: string;
  slug: string;
  display_name: string;
  country_code: string | null;
  environment: string | null;
};

type ProductState = {
  products: Product[];
  current: Product | null;
  productId: string | null;
  setProductId: (id: string) => void;
  loading: boolean;
  error: string | null;
};

const ProductContext = createContext<ProductState | undefined>(undefined);
const STORE_KEY = 'condorito.productId';

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('product_products')
        .select('id, slug, display_name, country_code, environment')
        .order('display_name');
      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        setProducts(data);
        const stored = localStorage.getItem(STORE_KEY);
        const valid = stored && data.some((p) => p.id === stored) ? stored : data[0]?.id ?? null;
        setProductIdState(valid);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setProductId = (id: string) => {
    setProductIdState(id);
    localStorage.setItem(STORE_KEY, id);
  };

  const current = products.find((p) => p.id === productId) ?? null;

  return (
    <ProductContext.Provider value={{ products, current, productId, setProductId, loading, error }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used within ProductProvider');
  return ctx;
}
