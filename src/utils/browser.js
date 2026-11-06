/**
 * Navegadores embutidos em apps (Instagram, Facebook, TikTok, Line e WebViews do Android).
 * Neles o "Salvar PDF" (impressão) costuma não funcionar, e o que fica salvo no navegador
 * não aparece depois no Chrome ou no Safari.
 * `; wv)` é a marca das WebViews do Android; o Chrome comum não a tem.
 */
const IN_APP_PATTERN = /FBAN|FBAV|FB_IAB|Instagram|\bLine\/|musical_ly|BytedanceWebview|; wv\)/i

export function isInAppBrowser(userAgent) {
  return IN_APP_PATTERN.test(userAgent ?? '')
}
