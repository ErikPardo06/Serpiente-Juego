var canvas, lienzo, score, dir, lastPress, gameover;
var body = [];
var food = new Rectangle(80, 80, 10, 10);
var medios = [];
var numMediosCargados = 0;

const ARRIBA = 0, DERECHA = 1, ABAJO = 2, IZQUIERDA = 3;

function Rectangle(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

Rectangle.prototype.intersects = function (rect) {
    if (rect != null) {
        return (this.x < rect.x + rect.width && this.x + this.width > rect.x &&
            this.y < rect.y + rect.height && this.y + this.height > rect.y);
    }
};

function iniciar() {
    canvas = document.getElementById('lienzo');
    lienzo = canvas.getContext('2d');
    cargarRecursos();
    chequearCarga();
}

function cargarRecursos() {
    medios['iBody'] = new Image();
    medios['iBody'].src = 'imgs/body.png';
    medios['iBody'].onload = function () { numMediosCargados++; };

    medios['iFood'] = new Image();
    medios['iFood'].src = 'imgs/fruit.png';
    medios['iFood'].onload = function () { numMediosCargados++; };

    medios['iWall'] = new Image();
    medios['iWall'].src = 'imgs/wall.png';
    medios['iWall'].onload = function () { numMediosCargados++; };

    medios['aComer'] = new Audio();
    medios['aComer'].src = 'sounds/chomp.m4a';
    medios['aComer'].oncanplaythrough = function () { numMediosCargados++; };

    medios['aMuerte'] = new Audio();
    medios['aMuerte'].src = 'sounds/dies.m4a';
    medios['aMuerte'].oncanplaythrough = function () { numMediosCargados++; };
}

function chequearCarga() {
    if (numMediosCargados >= 5) {
        reset();
        run();
        repaint();
    } else {
        setTimeout(chequearCarga, 100);
    }
}

function reset() {
    score = 0;
    dir = DERECHA;
    body = [];
    body.push(new Rectangle(40, 40, 10, 10));
    body.push(new Rectangle(0, 0, 10, 10));
    body.push(new Rectangle(0, 0, 10, 10));
    gameover = false;
    lastPress = null;
}

function run() {
    if (!gameover) act();
    setTimeout(run, 50);
}

function act() {
    if (lastPress == 38 && dir != ABAJO) dir = ARRIBA;
    if (lastPress == 39 && dir != IZQUIERDA) dir = DERECHA;
    if (lastPress == 40 && dir != ARRIBA) dir = ABAJO;
    if (lastPress == 37 && dir != DERECHA) dir = IZQUIERDA;

    for (var i = body.length - 1; i > 0; i--) {
        body[i].x = body[i - 1].x;
        body[i].y = body[i - 1].y;
    }

    if (dir == DERECHA) body[0].x += 10;
    if (dir == IZQUIERDA) body[0].x -= 10;
    if (dir == ARRIBA) body[0].y -= 10;
    if (dir == ABAJO) body[0].y += 10;

    if (body[0].x >= canvas.width) body[0].x = 0;
    if (body[0].y >= canvas.height) body[0].y = 0;
    if (body[0].x < 0) body[0].x = canvas.width - 10;
    if (body[0].y < 0) body[0].y = canvas.height - 10;

    if (body[0].intersects(food)) {
        score++;
        medios['aComer'].play();
        body.push(new Rectangle(0, 0, 10, 10));
        food.x = Math.floor(Math.random() * 50) * 10;
        food.y = Math.floor(Math.random() * 30) * 10;
    }

    for (var i = 2; i < body.length; i++) {
        if (body[0].intersects(body[i])) {
            gameover = true;
            medios['aMuerte'].play();
        }
    }
}

function paint(ctx) {
    var ptrn = ctx.createPattern(medios['iWall'], 'repeat');
    ctx.fillStyle = ptrn;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < body.length; i++) {
        ctx.drawImage(medios['iBody'], body[i].x, body[i].y);
    }

    ctx.drawImage(medios['iFood'], food.x, food.y);

    ctx.fillStyle = "#fff";
    ctx.fillText("Score: " + score, 10, 20);
    if (gameover) {
        ctx.fillText("GAME OVER", 200, 150);
    }
}

function repaint() {
    window.requestAnimationFrame(repaint);
    paint(lienzo);
}

document.addEventListener('keydown', function (evt) {
    lastPress = evt.keycode; 
    if (gameover && lastPress == 13) reset();
}, false);

window.addEventListener("load", iniciar, false);