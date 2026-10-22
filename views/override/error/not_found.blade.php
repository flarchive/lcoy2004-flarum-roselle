{{-- A página 404 do Discourse quando o recurso está ligado (lcoy/roselle); senão, a do core. --}}
@php
  $canelaNotFound = resolve(\Lcoy\Roselle\Gaps\NotFound\NotFoundPage::class);
  $canelaPage = $canelaNotFound->enabled() ? $canelaNotFound->data() : null;
@endphp
@if ($canelaPage)
  @include('lcoy-roselle-gaps::not-found', ['page' => $canelaPage, 'message' => $message])
@else
  @include('lcoy-roselle-gaps::core-not-found', ['message' => $message])
@endif
