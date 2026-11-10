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

/**
 * Onde a pessoa vai salvar o PDF a partir do diálogo de impressão do navegador:
 * 'ios' (iPhone/iPad: o iPadOS se apresenta como Mac, mas tem tela de toque), 'android' ou 'desktop'.
 */
export function printPlatform(userAgent, maxTouchPoints = 0) {
  const ua = userAgent ?? ''
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}
