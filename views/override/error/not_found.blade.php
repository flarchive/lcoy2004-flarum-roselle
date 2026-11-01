{{-- 功能开启时（lcoy/roselle）使用 Discourse 的 404 页面；否则用核心的。 --}}
@php
  $lcoyNotFound = resolve(\Lcoy\Roselle\Gaps\NotFound\NotFoundPage::class);
  $lcoyPage = $lcoyNotFound->enabled() ? $lcoyNotFound->data() : null;
@endphp
@if ($lcoyPage)
  @include('lcoy-roselle-gaps::not-found', ['page' => $lcoyPage, 'message' => $message])
@else
  @include('lcoy-roselle-gaps::core-not-found', ['message' => $message])
@endif
