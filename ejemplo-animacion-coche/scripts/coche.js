function iniciar()
{
	var iniciaAnimacion=document.getElementById("iniciaAnimacion");
	
	iniciaAnimacion.addEventListener("click", accionIniciaAnimacion, false);
} 

function accionIniciaAnimacion()
{
	var coche1=document.getElementById("coche1");
	
	coche1.className = "aCoche1";
	PrefixedEvent(coche1, "AnimationEnd", animacionCoche1Fin);
}

function animacionCoche1Fin()
{
	var coche2=document.getElementById("coche2");
	
	coche2.className = "aCoche2";
}

window.addEventListener("load", iniciar, false);

var pfx = ["webkit", "moz", "MS", "o", ""];

function PrefixedEvent(element, type, callback) 
{
	for (var p = 0; p < pfx.length; p++) 
	{
		if (pfx[p] == "" || pfx[p] == "o") 
			type = type.toLowerCase();
		element.addEventListener(pfx[p]+type, callback, false);
	}
}