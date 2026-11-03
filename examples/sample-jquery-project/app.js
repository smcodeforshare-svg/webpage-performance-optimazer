$(function () {
  for (let i = 0; i < 10; i++) {
    $('.item').text('Item ' + i);
  }

  $('.card').click(function () {
    console.log('clicked');
  });

  $.ajax({
    url: '/api/data',
    async: false,
    success: function (data) {
      console.log(data);
    }
  });

  window.addEventListener('scroll', function () {
    console.log(window.scrollY);
  });
});
