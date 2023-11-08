panel.plugin("flowers/flowers-blocks", {
  blocks: {
    imageSection: {
      template: `
        <div @dblclick="open" class="image-section">
          <div v-if="content.media" class="images">
            <div v-for="(image, index) in content.media" :key="index" class="image-section-media-item">
              <img v-if="image.content.media[0]" :src="image.content.media[0].url">
              <p>Caption: <span>{{ image.content.caption ? image.content.caption : '-----' }}</span></p>
              <p>Vimeo URL: <span>{{ image.content.vimeo_url ? image.content.vimeo_url : '-----' }}</span></p>
            </div>
          </div>

          <div class="info">
            <p>Slug: <span>{{ content.slug ? content.slug : '-----' }}</span></p>
          </div>
        </div>
      `
    },
    imageSectionMedia: {
      template: `
        <div @dblclick="open" class="image-section-media">
          <div v-if="content.media[0]" class="images">
            <img v-if="content.media[0]" :src="content.media[0].url">
            <p v-else>No file</p>
          </div>

          <div class="info">
            <p>Caption: <span>{{ content.caption ? content.caption : '-----' }}</span></p>
            <p>Vimeo URL: <span>{{ content.vimeo_url ? content.vimeo_url : '-----' }}</span></p>
          </div>
        </div>
      `
    },
    mediaItem: {
      template: `
        <div @dblclick="open" class="media-item">
          <div class="image">
            <img v-if="content.image[0]" :src="content.image[0].url">
            <p v-else>No file</p>
          </div>

          <div class="info">
            <p>Project: <span>{{ content.project[0] ? content.project[0].text : 'No project' }}</span></p>
            <p>Slug: <span>{{ content.slug ? content.slug : '-----' }}</span></p>
          </div>
        </div>
      `
    }
  }
});