import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from './browser'

const UA = {
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532)',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.86;]',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.104;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 13; moto g54 5G; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 musical_ly_2023405030 BytedanceWebview/d8a21c6',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}

describe('isInAppBrowser', () => {
  it.each(['instagramIos', 'facebookAndroid', 'facebookIos', 'tiktokAndroid', 'lineIos', 'androidWebView'])(
    'reconhece o navegador embutido: %s',
    (name) => {
      expect(isInAppBrowser(UA[name])).toBe(true)
    },
  )

  it.each(['chromeAndroid', 'safariIos', 'samsungInternet', 'chromeDesktop'])(
    'não confunde navegador comum: %s',
    (name) => {
      expect(isInAppBrowser(UA[name])).toBe(false)
    },
  )

  it.each([undefined, null, ''])('trata %j como navegador comum', (userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(false)
  })
})
