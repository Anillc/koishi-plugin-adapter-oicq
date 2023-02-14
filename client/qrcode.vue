<template>
  <k-comment type="init" v-if="self && qrcode">
    请扫码登录: <br/>
    <img :src="qrcode">
  </k-comment>
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import { store } from '@koishijs/client'

const local: any = inject('manager.settings.local')

const self = computed(() => {
  return local.value.name === 'koishi-plugin-adapter-oicq'
})

const qrcode = computed(() => {
  return store.oicq.qrcode
})

</script>