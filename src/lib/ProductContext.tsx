import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export type LegalDocumentsSource = 'CUSTOM' | 'ATOM';

export type Product = {
  id: string;
  slug: string;
  display_name: string;
  country_code: string | null;
  environment: string | null;
  legal_documents_source: LegalDocumentsSource;
};

type ProductState = {
  products: Product[];
  current: Product | null;
  productId: string | null;
  setProductId: (id: string) => void;
  setLegalDocumentsSource: (source: LegalDocumentsSource) => Promise<void>;
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
        .select('id, slug, display_name, country_code, environment, legal_documents_source')
        .order('display_name');
      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        setProducts(data as Product[]);
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

  const setLegalDocumentsSource = async (source: LegalDocumentsSource) => {
    if (!productId) return;
    const { data, error } = await supabase
      .from('product_products')
      .update({ legal_documents_source: source })
      .eq('id', productId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Product not updated. Check admin permissions.');
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, legal_documents_source: source } : p)),
    );
  };

  const current = products.find((p) => p.id === productId) ?? null;

  return (
    <ProductContext.Provider
      value={{ products, current, productId, setProductId, setLegalDocumentsSource, loading, error }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used within ProductProvider');
  return ctx;
}
