<section class="hero-banner">
  @foreach ($slides as $slide)
    <a class="hero-banner__slide" href="{{ $slide['link'] }}">
      <img src="{{ $slide['image'] }}" alt="{{ $slide['title'] }}">
    </a>
  @endforeach
</section>
