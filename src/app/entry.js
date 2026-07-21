'use strict';
import $ from 'jquery';
import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/dist/css/bootstrap.min.css';

const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.on('click', () => {
  const memoryId = buttonSelfComment.data('memory-id');
  const userId = buttonSelfComment.data('user-id');
  const comment = prompt('コメントを255文字以内で入力してください。');
  if (comment) {
    fetch(`/memories/${memoryId}/users/${userId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment }),
    })
      .then((response) => response.json())
      .then((data) => {
        $('#self-comment').text(data.comment);
      });
  }
});