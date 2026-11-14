/* =========================================================================
   云端配置（公开部分）
   -------------------------------------------------------------------------
   仅包含设计上即可公开的值：
   - Supabase 项目 URL 与 anon key（anon key 本就是浏览器端公开密钥，
     RLS 保证匿名身份对四张业务表零权限）
   - GitHub 仓库公开信息与 Pages 地址（只读展示用）
   绝不在此文件出现 service_role / sb_secret_ / GitHub Token 等任何密钥。
   需要保密的值全部由平台注入到 Edge Function / Actions 运行环境。
   ========================================================================= */
(function (global) {
  'use strict';
  global.ZWZ_CLOUD = {
    /* Supabase 项目（PostgREST / Auth / Storage / Edge Functions 同域） */
    url: 'https://ypvpaqkjnxgcnnupfrmy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdnBhcWtqbnhnY25udXBmcm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NTM5OTMsImV4cCI6MjExMDEyOTk5M30.mSomPQtDoljIjELjacYMfmXoRCy0tpGvY5Ylh7kw4UI',
    /* 私有图片桶 */
    bucket: 'portfolio-uploads',
    /* GitHub（只读展示：Actions 运行结果 / Pages 地址） */
    githubOwner: 'gejia8386-dotcom',
    githubRepo: 'zeng-wenzhuo-portfolio',
    pagesUrl: 'https://gejia8386-dotcom.github.io/zeng-wenzhuo-portfolio/',
    /* 发布函数（已部署，本阶段只接入不重建） */
    publishEndpoint: 'https://ypvpaqkjnxgcnnupfrmy.supabase.co/functions/v1/publish'
  };
})(typeof window !== 'undefined' ? window : globalThis);
