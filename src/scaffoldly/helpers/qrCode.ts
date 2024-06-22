import qrcode from 'qrcode-terminal';

type TotpQr = {
  qr: string;
  secret: string | null;
};

export const generateTotpQr = (uri: string): Promise<TotpQr> => {
  const url = new URL(uri);
  const secret = url.searchParams.get('secret');
  return new Promise<TotpQr>((resolve) => {
    qrcode.generate(uri, { small: true }, (qr) => {
      resolve({
        qr,
        secret,
      });
    });
  });
};
