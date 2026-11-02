{{-- 核心 404 页面的副本，用于主题的 404 页面被关闭时。 --}}
@extends('flarum.forum::layouts.basic')

@section('content')
  <p>
    {{ $message }}
  </p>
  <p>
    <a href="{{ $url->to('forum')->base() }}">
      {{ $translator->trans('core.views.error.not_found_return_link', ['forum' => $settings->get('forum_title')]) }}
    </a>
  </p>
@endsection
