<template>
  <!-- 刺绣游戏弹窗：原 game/index.js 的 renderGame() 字符串模板迁入，
       挂载位置保持一致（body 层级）。所有游戏逻辑仍由 game/script.js 承担，
       本组件只负责渲染结构 + 转发点击事件 -->
  <Teleport to="body">
    <div id="game-root">
      <div id="ov" class="overlay" @click.self="closeModal()">
        <div class="modal">
          <div class="modal-hd">
            <div class="modal-title">刺绣游戏体验</div>
            <div class="modal-sub">选择游戏，亲手完成一幅刺绣作品</div>
            <button class="close-btn" @click="closeModal()">✕</button>
          </div>

          <div id="s-select" class="screen active">
            <div class="game-select">
              <div class="game-card" @click="startGame('trace')">
                <div class="g-icon">🪡</div>
                <div class="g-name">描线走针</div>
                <div class="g-desc">沿引导线描绘针迹，完成 5 次描线后产出作品。</div>
              </div>
              <div class="game-card" @click="startGame('jigsaw')">
                <div class="g-icon">🧩</div>
                <div class="g-name">针法识别</div>
                <div class="g-desc">识别全部 9 块后产出作品。</div>
              </div>
            </div>
          </div>

          <div id="s-trace" class="screen">
            <div class="game-hd">
              <span class="back-btn" @click="goBack()">← 返回</span>
              <span class="g-title">描线走针</span>
              <span class="g-score">准确度 <span id="t-acc">—</span></span>
            </div>
            <div class="pill-row">
              <button class="s-pill on" data-s="flat" @click="pickStitch($event.currentTarget)">平针</button>
              <button class="s-pill" data-s="back" @click="pickStitch($event.currentTarget)">回针</button>
              <button class="s-pill" data-s="blanket" @click="pickStitch($event.currentTarget)">锁边针</button>
            </div>
            <div class="prog-wrap"><div id="t-prog" class="prog-fill"></div></div>
            <div class="cvs-wrap">
              <canvas id="tCvs"></canvas>
              <div id="t-hint" class="hint"></div>
            </div>
          </div>

          <div id="s-jig" class="screen">
            <div class="game-hd">
              <span class="back-btn" @click="goBack()">← 返回</span>
              <span class="g-title">针法识别</span>
              <span class="g-score">已完成 <span id="j-cnt">0</span> / 9</span>
            </div>
            <div class="jig-wrap">
              <div id="jigGrid" class="jig-grid"></div>
              <div id="j-hint" class="hint"></div>
              <div id="jigOpts" class="jig-opts"></div>
            </div>
          </div>

          <div id="s-done" class="screen">
            <div class="done-wrap">
              <div class="done-title">✦ 作品完成 ✦</div>
              <canvas id="doneCvs" class="done-cvs"></canvas>
              <div id="done-txt" class="done-sub"></div>
              <div class="btn-row">
                <button class="c-btn" @click="goBack()">再玩一次</button>
                <button class="c-btn" @click="closeModal()">关闭</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import '../../page/teach/game/game.css'
import { closeModal, startGame, pickStitch, goBack } from '../../page/teach/game/script.js'
</script>
