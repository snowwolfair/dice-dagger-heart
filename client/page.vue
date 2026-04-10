<template>
  <k-layout>
    <k-layout-content>
      <k-card title="匕首之心设置">
        <form :model="config" :rules="rules" ref="form">
          <form-item label="骰子掷出延迟时间" prop="dalayTime">
            <!-- <input v-model="config.dalayTime" placeholder="请输入延迟时间（毫秒）">
            </input> -->
            <div class="k-form-desc" @hover="">骰子掷出后的延迟显示时间，单位毫秒</div>
          </form-item>

          <form-item>
            <k-button type="primary" @click="saveConfig">保存设置</k-button>
            <k-button @click="resetConfig">重置</k-button>
          </form-item>
        </form>
      </k-card>

      <k-card title="功能说明" style="margin-top: 20px;">
        <p><strong>匕首之心机器人插件</strong></p>
        <p>主要功能：</p>
        <ul>
          <li>骰子掷骰功能</li>
          <li>角色创建功能</li>
          <li>自定义延迟设置</li>
        </ul>
      </k-card>
    </k-layout-content>
  </k-layout>
  <k-card>{{ store.custom }}</k-card>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import { send, store } from '@koishijs/client'

interface Config {
  dalayTime: number
}

const config = reactive<Config>({
  dalayTime: 1000
})

const rules = {
  dalayTime: [
    { required: true, message: '请输入延迟时间', trigger: 'blur' },
    { type: 'number', min: 0, max: 10000, message: '延迟时间应在 0-10000 毫秒之间', trigger: 'blur' }
  ]
}

// 加载配置
const loadConfig = async () => {
  try {
    const result = {}
    if (result) {
      Object.assign(config, result)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

// 保存配置
const saveConfig = async () => {
  console.log('保存配置:', config)
}

// 重置配置
const resetConfig = () => {
  config.dalayTime = 1000
}

onMounted(() => {
  loadConfig()
})
</script>