/// <reference types="node" />

declare module 'pdf-parse' {
  function pdfParse(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }>;
  export = pdfParse;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjsLib: any;
  export = pdfjsLib;
}
