/*
* Basic examplaray WebAudio player
*/

function Player ( url, el ) {
  this.ac = new ( window.AudioContext || webkitAudioContext )();
  this.url = url;
  this.el = el;
  this.button = el.querySelector('.button');
  this.track = el.querySelector('.track');
  this.progress = el.querySelector('.progress');
  this.scrubber = el.querySelector('.scrubber');
  this.message = el.querySelector('.message');
  this.message.innerHTML = 'Loading';
  this.bindEvents();
  this.fetch();
}

Player.prototype.bindEvents = function() {
  this.button.addEventListener('click', this.toggle.bind(this));
  this.scrubber.addEventListener('mousedown', this.onMouseDown.bind(this));
  window.addEventListener('mousemove', this.onDrag.bind(this));
  window.addEventListener('mouseup', this.onMouseUp.bind(this));
};


Player.prototype.fetch = function() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', this.url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    this.decode(xhr.response);
  }.bind(this);
  xhr.send();
};

Player.prototype.decode = function( arrayBuffer ) {
  this.ac.decodeAudioData(arrayBuffer, function( audioBuffer ) {
    this.message.innerHTML = '';
    this.buffer = audioBuffer;
    this.draw();
    this.play();
  }.bind(this));
};

Player.prototype.connect = function() {
  if ( this.playing ) {
    this.pause();
  }
  this.source = this.ac.createBufferSource();
  this.source.buffer = this.buffer;
  this.source.connect(this.ac.destination);
};

Player.prototype.play = function( position ) {
  this.connect();
  this.position = typeof position === 'number' ? position : this.position || 0;
  this.startTime = this.ac.currentTime - ( this.position || 0 );
  this.source.start(this.ac.currentTime, this.position);
  this.playing = true;
};

Player.prototype.pause = function() {
  if ( this.source ) {
    this.source.stop(0);
    this.source = null;
    this.position = this.ac.currentTime - this.startTime;
    this.playing = false;
  }
};

Player.prototype.seek = function( time ) {
  if ( this.playing ) {
    this.play(time);
  }
  else {
    this.position = time;
  }
};

Player.prototype.updatePosition = function() {
  this.position = this.playing ?
    this.ac.currentTime - this.startTime : this.position;
  if ( this.position >= this.buffer.duration ) {
    this.position = this.buffer.duration;
    this.pause();
  }
  return this.position;
};

Player.prototype.toggle = function() {
  if ( !this.playing ) {
    this.play();
  }
  else {
    this.pause();
  }
};

Player.prototype.onMouseDown = function( e ) {
  this.dragging = true;
  this.startX = e.pageX;
  this.startLeft = parseInt(this.scrubber.style.left || 0, 10);
};

Player.prototype.onDrag = function( e ) {
  var width, position;
  if ( !this.dragging ) {
    return;
  }
  width = this.track.offsetWidth;
  position = this.startLeft + ( e.pageX - this.startX );
  position = Math.max(Math.min(width, position), 0);
  this.scrubber.style.left = position + 'px';
};

Player.prototype.onMouseUp = function() {
  var width, left, time;
  if ( this.dragging ) {
    width = this.track.offsetWidth;
    left = parseInt(this.scrubber.style.left || 0, 10);
    time = left / width * this.buffer.duration;
    this.seek(time);
    this.dragging = false;
  }
};

Player.prototype.draw = function() {
  var progress = ( this.updatePosition() / this.buffer.duration ),
    width = this.track.offsetWidth;
  if ( this.playing ) {
    this.button.classList.add('fa-pause');
    this.button.classList.remove('fa-play');
  } else {
    this.button.classList.add('fa-play');
    this.button.classList.remove('fa-pause');
  }
  this.progress.style.width = ( progress * width ) + 'px';
  if ( !this.dragging ) {
    this.scrubber.style.left = ( progress * width ) + 'px';
  }
  requestAnimationFrame(this.draw.bind(this));
};

module.exports = Player;