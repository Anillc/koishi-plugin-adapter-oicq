import { defineExtension } from '@koishijs/client'
import QRCode from './qrcode.vue'

export default defineExtension(ctx => {
  ctx.slot({
    type: 'market-settings',
    component: QRCode,
  })
})