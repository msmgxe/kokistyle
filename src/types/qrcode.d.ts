declare module "qrcode" {
  interface QrCodeColorOptions {
    dark?: string;
    light?: string;
  }

  interface QrCodeToDataUrlOptions {
    margin?: number;
    width?: number;
    color?: QrCodeColorOptions;
  }

  export function toDataURL(
    text: string,
    options?: QrCodeToDataUrlOptions,
  ): Promise<string>;
}
