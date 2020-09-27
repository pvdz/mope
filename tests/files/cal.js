//1) No events may visually overlap.
//2) If two events collide in time, they must have the same width.
//3) An event should utilize the maximum width available, but constraint 2) takes precedence over this constraint.
// 620px wide (600px + 10px padding on the left/right)
// 720px high (the day will end at 9pm): 700 / 12*60 = 1px/min

// [ {start: 30, end: 150}, {start: 540, end: 600}, {start: 560, end: 620}, {start: 610, end: 670} ]

var HALFHOUR = 30;

/**
 * Represents one event of the calendar
 *
 * @constructor
 * @param {Object} obj
 * @property {number} obj.start
 * @property {number} obj.end
 */
function CalendarEvent(obj){
  this.start = obj.start;
  this.end = obj.end;
}
CalendarEvent.prototype = {
  start: 0,
  end: 0,
  element: null,

  /**
   * Does this event start in given range?
   *
   * @param {number} begin
   * @param {number} end
   * @return {boolean}
   */
  startsBetween: function(begin, end){
    return (this.start >= begin && this.start < end);
  },
  /**
   * Create a section element for an event and return it
   *
   * @return {HTMLElement}
   */
  createElement: function(){
    var section = document.createElement('section');
    section.setAttribute('style', 'top: '+this.start+'px; height: '+(this.end-(this.start))+'px;');
    section.innerHTML =
      '<div class="event">'+
      '<h1>Sample item</h1>' +
      '<h2>Sample location</h2>' +
      '</div>';

    return section;
  },
};

/**
 * One day of a calendar
 *
 * @constructor
 * @param {CalendarEvent[]} events Should be objects with a start and end property
 */
function CalendarPage(events){
  this.events = events;
}
CalendarPage.prototype = {
  events: null,
  container: null,

  // left and right are used to detect double bookings; events that overlap
  left: null,
  right: null,

  /**
   * Adds the page to the DOM. Make sure this.create has been called.
   */
  show: function(){
    document.body.appendChild(this.container);
  },

  /**
   * Starts the generating process. Does not add result to DOM.
   *
   * @return {this}
   */
  create: function(){
    var container = document.createElement('div');
    this.container = container;
    container.appendChild(this.createStyleSheet());

    this.orderEvents();

    var ol = document.createElement('ol');
    this.fillDay(ol);
    container.appendChild(ol);

    return this;
  },
  /**
   * Make sure events are ordered by start time, descending
   */
  orderEvents: function(){
    var events = this.events;
    events.sort(function(a,b){
      if (a.start < b.start) return -1;
      if (a.start > b.start) return 1;
      return 0;
    });
  },
  /**
   * Create the contents of the page
   *
   * @param {HTMLOListElement} ol
   */
  fillDay: function(ol){
    this.left = null;
    this.right = null;

    for (var i=0; i<25; ++i) {
      this.createHalfHour(ol, i);
    }

    this.left = null;
    this.right = null;
  },
  /**
   * Add a half hour of timestamps and events to the ol
   *
   * @param {HTMLOListElement} ol
   * @param {number} i The nth half hour of the day
   */
  createHalfHour: function(ol, i){
    var li = document.createElement('li');
    this.addTimestamp(li, i);
    this.addEvents(li, i);
    ol.appendChild(li);
  },
  /**
   * Get the events that start in the next half hour, starting at currentTime
   *
   * @param {number} currentTime In minutes from 9am
   * @return {CalendarEvent[]}
   */
  getStartingEvents: function(currentTime){
    return this.events.filter(function(e){
      return e.startsBetween(currentTime, currentTime+HALFHOUR);
    }, this);
  },
  /**
   * Create a left timestamp and adds it to the given ol
   *
   * @param {HTMLLIElement} li
   * @param {number} i The nth half hour
   */
  addTimestamp: function(li, i){
    var time = document.createElement('time');
    if (i % 2) time.innerHTML = this.toTimeSmall(i*HALFHOUR);
    else time.innerHTML = this.toTimeBig(i*HALFHOUR);
    li.appendChild(time);
  },
  /**
   * Adds all events that start in the current half hour to the li
   *
   * @param {HTMLLIElement} li
   * @param {number} i The nth half hour
   */
  addEvents: function(li, i){
    var currentTime = i * HALFHOUR;

    var targets = this.getStartingEvents(currentTime);
    targets.forEach(function(target){
      var el = target.createElement();
      target.element = el;

      if (this.left && this.left.end <= target.start) this.left = null;
      if (this.right && this.right.end <= target.start) this.right = null;

      // prevent three events at once
      var clash = this.fixDoubleBooking(target, el);
      if (!clash) li.appendChild(el);
    }, this);
  },
  /**
   * Checks whether target event is going to fit in the day. Will return
   * true if the given target overlaps with at least two other events.
   *
   * @param {CalendarEvent} target The event currently being added
   * @param {HTMLTableSectionElement} el The element containing the event information
   * @return {boolean} true only if target overlaps with >=2 other events, undefined otherwise
   */
  fixDoubleBooking: function(target, el){
    if (!this.left && this.right) {
      el.setAttribute('data-col', 'left');
      this.left = target;
    } else if (this.left && !this.right) {
      el.setAttribute('data-col', 'right');
      this.right = target;
      this.left.element.setAttribute('data-col', 'left');
    } else if (this.left && this.right) {
      console.warn('More than two overlapping events are out of scope of assignment (no need for feature creep). Some items are dropped.');
      return true;
    } else {
      this.left = target;
    }
  },

  /**
   * Generates the stylesheet needed to make everything pretty.
   *
   * @return {HTMLStyleElement}
   */
  createStyleSheet: function(){
    var css = ''+
      'ol { position: relative; margin: 15px 0 30px 81px; padding: 0; width: 620px; height: 720px; background-color: #ececec; border-left: 1px solid #ccc; }' +
      'li { list-style: none; clear: left; height: 30px; margin-left: -81px; }' +
      'time {' +
      '  float: left;' +
      '  font-family: sans-serif;' +
      '  text-align: right;' +
      '  background-color: white;' +
      '  width: 70px;' +
      '  height: 30px;' +
      '  line-height: 30px;' +
      '  padding-right: 10px;' +
      '  margin-top: -15px;' +
      '  color: #737373;' +
      '  font-size: 14px;' +
      '  font-weight: bold;' +
      '}' +
      'time small { color: #c0c0c0; font-size: 10px; }' +
      'section {' +
      '  position: absolute;' +
      '  left: 10px;' +
      '  width: 600px;' +
      '  overflow: auto;' +
      '  border: 0;' +
      '  border-left: 4px solid #4b6ea9;' +
      '  background-color: white;' +
      '  -moz-box-sizing: border-box;' +
      '  box-sizing: border-box;' +
      '}' +
      'section[data-col=left] { width: 300px; }' +
      'section[data-col=right] { width: 300px; left: 310px; }' +
      '.event {' +
      '  padding: 5px;' +
      '  border: 1px solid #ccc;' +
      '  border-left: 0;' +
      '  height: 100%;' +
      '  -moz-box-sizing: border-box;' +
      '  box-sizing: border-box;' +
      '}' +
      'h1 { color: #4b6ea9; font-size: 12px; font-weight: bold; margin: 0; padding: 0; font-family: sans-serif; }' +
      'h2 { color: #797979; font-size: 10px; font-weight: normal; margin: 0; padding: 0; font-family: sans-serif; }'+
      '';

    var sheet = document.createElement('style');
    sheet.textContent = css;
    sheet.scoped = true;
    return sheet;
  },

  /**
   * Minutes to time converter
   *
   * @param {number} min
   * @return {Object}
   */
  minToTime: function(min){
    var hour = Math.floor(9 + Math.floor(min/60));
    var min = Math.floor(min % 60);
    var ampm = 'AM';

    if (hour > 11) ampm = 'PM';
    if (hour > 12) hour -= 12;

    return {
      hour:hour,
      min:min,
      ampm:ampm
    };
  },
  /**
   * Big timestamp formatter
   *
   * @param {number} min
   * @return {string}
   */
  toTimeBig: function(min){
    var obj = this.minToTime(min);
    return obj.hour+':'+obj.min+(obj.min<10?'0':'')+' <small>'+obj.ampm+'</small>';
  },
  /**
   * Small timestamp number formatter
   * @param {number} min
   * @return {string}
   */
  toTimeSmall: function(min){
    var obj = this.minToTime(min);
    return '<small>'+obj.hour+':'+obj.min+(obj.min<10?'0':'')+'</small>';
  },
};

/**
 * Randomly assign up to 100 events to be displayed on the current day.
 * Events will happen randomly. There's a 1% chance that a triple
 * overlap is not prevented, to make sure that's handled properly.
 */
function fuzzyTesting(){
  // fuzzy testing enabled
  setInterval(function(){
    document.body.innerHTML = '';

    var arr = [];
    for (var i= 0, n=Math.random() * 100; i<n; ++i) {
      var start = Math.floor(Math.random() * 650);
      var stop = Math.floor(start + (Math.random() * (700 - start)));

      var o = {start: start, end:stop};
      arr.push(o);

      arr.sort(function(a,b){
        if (a.start < b.start) return -1;
        if (a.start > b.start) return 1;
        return 0;
      });

      var left = null;
      var right = null;
      for (var a=0; a<arr.length; ++a) {
        var t = arr[a];
        if (left && t.start > left.end) left = null;
        if (right && t.start > right.end) right = null;

        if (!left) left = t;
        else if (!right) right = t;
        else if (Math.random() > 0.01) { // 1% of triple overlaps pass to make sure stuff doesnt break
          arr.splice(arr.indexOf(o), 1);
          break;
        }
      }
    }
//    console.log(JSON.stringify(arr).replace(/"/g,''))
    layOutDay(arr);
  }, 10);
}

/**
 * Public api.
 *
 * @param {Object[]} events
 */
function layOutDay(events) {
  new CalendarPage(events.map(function(obj){ return new CalendarEvent(obj); })).create().show();
}

//layOutDay([ {start: 60, end: 120}, {start: 540, end: 600}, {start: 560, end: 620}, {start: 610, end: 670} ]);
//layOutDay([{start:99,end:531},{start:79,end:115},{start:609,end:644},{start:283,end:639}] )
fuzzyTesting();
