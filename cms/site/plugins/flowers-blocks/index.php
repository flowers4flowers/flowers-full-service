<?php
Kirby::plugin('flowers/flowers-blocks', [
  'blueprints' => [
    'blocks/imageSection' => __DIR__ . '/blueprints/blocks/imageSection.yml',
    'blocks/imageSectionMedia' => __DIR__ . '/blueprints/blocks/imageSectionMedia.yml',
    'blocks/mediaItem' => __DIR__ . '/blueprints/blocks/mediaItem.yml',
  ]
]);