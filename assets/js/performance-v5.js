/* Cheers V5: menú instantáneo y fotos ligeras para teléfonos. */
function renderProductsV5(category="todos"){
  menuSection.dataset.theme=menuThemes[category]||"all";
  const visible=products.filter(product=>category==="todos"||product.category===category);
  grid.innerHTML=visible.map(product=>`<article class="product ${product.imageUrl?"has-photo":""} ${product.available?"":"sold-out"}" style="--accent:${product.accent||"#75a94a"}">${product.imageUrl?`<img class="product-photo" src="${escape(product.imageUrl)}" loading="lazy" decoding="async" alt="">`:""}<p class="product-tag">${escape(product.tag)}</p><h3>${escape(product.name)}</h3><p>${escape(product.description)}</p><div class="product-bottom"><span class="price">${money.format(product.price)}</span><button class="add-item" data-id="${product.id}" ${product.available?"":"disabled"} aria-label="Agregar ${escape(product.name)}" type="button">${product.available?"+":"Agotado"}</button></div></article>`).join("");
}
setTimeout(()=>{window.renderProducts=renderProductsV5;if(typeof products!=="undefined"&&products.length)renderProductsV5()},0);
