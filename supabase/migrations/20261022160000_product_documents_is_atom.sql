/*
# ATOM flag on product documents

ATOM documents are served from ATOM (slug = ATOM documentFormat) instead of
product_document_content. Existing documents stay custom.
*/

ALTER TABLE product_documents
  ADD COLUMN IF NOT EXISTS is_atom boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_documents_product_is_atom
  ON product_documents (product_id, is_atom);
