import seedStore from "./seed-store.json" with { type: "json" };

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const fail=(message,status=400)=>json({error:message},status);
const one=items=>Array.isArray(items)?items[0]:items;
const category=value=>String(value||"especiales").trim().toLowerCase();
let initialized,publicMenuCache={until:0,data:null};
const publicRequests=new Map();
const publicJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=15, s-maxage=15, stale-while-revalidate=45"}});
const invalidatePublicMenu=()=>{publicMenuCache={until:0,data:null}};

function allowPublicRequest(request,bucket,limit=8,windowMs=60000){
  const forwarded=request.headers.get("x-nf-client-connection-ip")||request.headers.get("x-forwarded-for")||"visitante";
  const key=`${bucket}:${forwarded.split(",")[0].trim()}`;
  const now=Date.now(),recent=(publicRequests.get(key)||[]).filter(time=>now-time<windowMs);
  if(recent.length>=limit)return false;
  recent.push(now);publicRequests.set(key,recent);return true;
}

function keys(){
  const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
  if(!url||!service)throw new Error("Falta agregar la clave segura de Supabase en Netlify.");
  return {url,service,anon:process.env.SUPABASE_ANON_KEY||service};
}
async function call(path,options={}){
  const {url,service}=keys();
  const response=await fetch(`${url}${path}`,{method:options.method||"GET",headers:{apikey:service,authorization:`Bearer ${options.token||service}`,"content-type":"application/json",...(options.headers||{})},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const output=(response.headers.get("content-type")||"").includes("json")?await response.json():await response.text();
  if(!response.ok){
    const detail=output?.message||output?.error_description||output?.error||output?.code||(typeof output==="string"&&output.slice(0,180));
    throw new Error(detail||"No pudimos completar la acción.");
  }
  return output;
}
const db=(path,options)=>call(`/rest/v1/${path}`,options);
const supaAuth=(path,options)=>call(`/auth/v1/${path}`,options);

async function setup(){
  if(initialized)return initialized;
  initialized=(async()=>{
    let org=one(await db("organizations?slug=eq.cheers&select=id"));
    if(!org)org=one(await db("organizations",{method:"POST",headers:{Prefer:"return=representation"},body:{name:"Cheers",slug:"cheers"}}));
    let location=one(await db(`locations?organization_id=eq.${org.id}&select=*`));
    if(!location)location=one(await db("locations",{method:"POST",headers:{Prefer:"return=representation"},body:{organization_id:org.id,name:"Cheers",currency:"COP"}}));
    let categories=await db(`categories?location_id=eq.${location.id}&select=*`);
    for(const name of [...new Set(seedStore.products.map(x=>category(x.category)))]){
      if(categories.some(x=>x.name===name))continue;
      const created=one(await db("categories",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:location.id,name,sort_order:categories.length}}));
      categories.push(created);
    }
    const products=await db(`products?location_id=eq.${location.id}&select=id,name`);
    if(!products.length){
      const ids=Object.fromEntries(categories.map(x=>[x.name,x.id]));
      await db("products",{method:"POST",body:seedStore.products.map(p=>({location_id:location.id,category_id:ids[category(p.category)],name:p.name,description:p.description||"",price:p.price,active:p.active!==false,image_url:p.imageUrl||""}))});
    }else{
      const ids=Object.fromEntries(categories.map(x=>[x.name,x.id]));
      const missing=seedStore.products.filter(product=>!products.some(row=>row.name===product.name));
      if(missing.length)await db("products",{method:"POST",body:missing.map(p=>({location_id:location.id,category_id:ids[category(p.category)],name:p.name,description:p.description||"",price:p.price,active:p.active!==false,image_url:p.imageUrl||""}))});
    }
    const tables=await db(`dining_tables?location_id=eq.${location.id}&select=id`);
    if(!tables.length)await db("dining_tables",{method:"POST",body:seedStore.tables.map(t=>({location_id:location.id,name:t.name,code:String(t.id).padStart(2,"0"),active:t.active!==false}))});
    const ingredients=await db(`ingredients?location_id=eq.${location.id}&select=id`);
    if(!ingredients.length&&seedStore.inventory?.length)await db("ingredients",{method:"POST",body:seedStore.inventory.map(i=>({location_id:location.id,name:i.name,unit:i.unit,stock:Number(i.stock)||0,minimum_stock:Number(i.minimum)||0,cost:Number(i.cost)||0}))});
    return {org,location,categories};
  })().catch(reason=>{initialized=null;throw reason});
  return initialized;
}
async function staffAccounts(org,location){
  const list=await supaAuth("admin/users?page=1&per_page=1000");
  const current=list.users||[];
  const users=[
    {email:"admin@cheers.local",password:"1234",name:"Administrador",role:"admin"},
    {email:"dora@cheers.local",password:"1111",name:"Dora",role:"cashier"},
    {email:"daniela@cheers.local",password:"2222",name:"Daniela",role:"cashier"},
    {email:"juan@cheers.local",password:"3333",name:"Juan",role:"cashier"}
  ];
  for(const person of users){
    let account=current.find(x=>x.email===person.email);
    if(!account){
      const created=await supaAuth("admin/users",{method:"POST",body:{email:person.email,password:person.password,email_confirm:true}});
      account=created?.user||created;
    }
    const profile=one(await db(`profiles?id=eq.${account.id}&select=id`));
    if(!profile)await db("profiles",{method:"POST",body:{id:account.id,organization_id:org.id,location_id:location.id,name:person.name,role:person.role}});
  }
}
async function dataContext(){const data=await setup();data.categories=await db(`categories?location_id=eq.${data.location.id}&select=*`);return data}
async function productsData(){
  const data=await dataContext();
  const rows=await db(`products?location_id=eq.${data.location.id}&select=*&order=created_at.asc`);
  const ids=rows.map(x=>x.id).join(",");
  const [recipes,ingredients,options]=await Promise.all([
    ids?db(`recipes?product_id=in.(${ids})&select=*`):[],
    db(`ingredients?location_id=eq.${data.location.id}&select=id,stock`),
    ids?db(`product_options?product_id=in.(${ids})&active=eq.true&select=*&order=sort_order.asc`):[]
  ]);
  const stock=Object.fromEntries(ingredients.map(item=>[item.id,Number(item.stock)]));
  return {data,products:rows.map(row=>{
    const recipe=recipes.filter(item=>item.product_id===row.id).map(item=>({ingredientId:item.ingredient_id,amount:Number(item.amount)}));
    return {id:row.id,name:row.name,description:row.description||"",price:Number(row.price),category:category(data.categories.find(c=>c.id===row.category_id)?.name),tag:"Menú",imageUrl:row.image_url||"",active:row.active!==false,recipe,options:options.filter(item=>item.product_id===row.id).map(item=>item.name),available:!recipe.length||recipe.every(item=>(stock[item.ingredientId]||0)>=item.amount)};
  })};
}
function publicLocation(location){return {id:location.id,name:location.name,currency:location.currency,address:location.address||"",hours:location.hours||"",whatsapp:location.whatsapp||"",instagram:location.instagram||""}}
async function publicMenu(){if(publicMenuCache.data&&Date.now()<publicMenuCache.until)return publicMenuCache.data;const {data,products}=await productsData(),tables=await db(`dining_tables?location_id=eq.${data.location.id}&select=*&order=code.asc`),payload={location:publicLocation(data.location),products,tables:tables.map(t=>({id:Number(t.code),name:t.name,active:t.active!==false}))};publicMenuCache={data:payload,until:Date.now()+15000};return payload}
async function readBody(request){try{return await request.json()}catch{return {}}}
async function currentUser(request){
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)throw new Error("Inicia sesión para continuar.");
  const account=await supaAuth("user",{token});
  const profile=one(await db(`profiles?id=eq.${account.id}&select=*`));
  if(!profile)throw new Error("Este usuario no tiene acceso a Cheers.");
  const roles={admin:"Administrador",manager:"Administrador",cashier:"Caja",bar:"Barra",kitchen:"Cocina"};
  return {id:account.id,name:profile.name,email:account.email,role:roles[profile.role]||"Caja",token};
}
function requireRole(user,roles=["Administrador"]){if(!roles.includes(user.role))throw new Error("No tienes permiso para esta acción.")}
async function tableFor(location,id){return one(await db(`dining_tables?location_id=eq.${location.id}&code=eq.${String(id).padStart(2,"0")}&select=*`))}
async function orderWithItems(order){
  const items=await db(`order_items?order_id=eq.${order.id}&select=*&order=id.asc`);
  return {id:order.id,code:order.code,type:order.order_type,tableId:order.table_id,status:order.status,total:Number(order.total),customerName:order.customer_name||"",customerId:order.customer_id||null,createdAt:order.created_at,items:items.map(i=>({productId:i.product_id,name:i.name,quantity:Number(i.quantity),unitPrice:Number(i.unit_price),options:i.selected_options||[],note:i.note||""}))};
}
async function addOrder(input,completed=false){
  const {data,products}=await productsData();
  if(!Array.isArray(input.items)||!input.items.length)throw new Error("Agrega al menos un producto.");
  const table=input.type==="table"?await tableFor(data.location,input.tableId):null;
  if(input.type==="table"&&!table)throw new Error("Mesa inválida.");
  const lines=input.items.map(item=>{const product=products.find(p=>p.id===item.productId&&p.active&&p.available);if(!product)throw new Error("Este producto se agotó. Actualiza el menú e intenta de nuevo.");return {product,quantity:Math.max(1,Number(item.quantity)||1),options:Array.isArray(item.options)?item.options:[],note:String(item.note||"").slice(0,140)}});
  const total=lines.reduce((sum,line)=>sum+line.product.price*line.quantity,0);
  let creditCustomer=null;
  if(completed&&input.method==="Fiado"){
    creditCustomer=one(await db(`customers?id=eq.${String(input.customerId||"")}&location_id=eq.${data.location.id}&active=eq.true&select=*`));
    if(!creditCustomer)throw new Error("Selecciona un cliente para fiar.");
    const current=(await customerBalances(data.location)).find(item=>item.id===creditCustomer.id)?.balance||0,limit=Number(creditCustomer.credit_limit)||0;
    if(limit>0&&current+total>limit)throw new Error("El cupo de este cliente no alcanza para la factura.");
  }
  const row=one(await db("orders",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:data.location.id,table_id:table?.id||null,code:`CH-${String(Date.now()).slice(-5)}`,order_type:input.type==="table"?"table":"takeaway",status:completed?"completed":"new",customer_id:creditCustomer?.id||null,customer_name:String(input.customerName||creditCustomer?.name||"").slice(0,60),notes:String(input.notes||"").slice(0,300),total}}));
  await db("order_items",{method:"POST",body:lines.map(line=>({order_id:row.id,product_id:line.product.id,name:line.product.name,quantity:line.quantity,unit_price:line.product.price,selected_options:line.options,note:line.note}))});
  await consumeInventory(lines,row.id);invalidatePublicMenu();
  if(completed&&creditCustomer)await db("customer_ledger",{method:"POST",body:{customer_id:creditCustomer.id,order_id:row.id,kind:"charge",amount:total,method:"Fiado",note:"Factura de caja"}});
  else if(completed)await db("payments",{method:"POST",body:{order_id:row.id,amount:total,method:input.method||"Efectivo"}});
  return orderWithItems(row);
}
async function categoryId(data,name){const clean=category(name);let item=data.categories.find(x=>x.name===clean);if(!item){item=one(await db("categories",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:data.location.id,name:clean,sort_order:data.categories.length}}));data.categories.push(item)}return item.id}
async function saveRecipe(productId,recipe=[]){
  const clean=Array.isArray(recipe)?recipe.filter(x=>x.ingredientId&&Number(x.amount)>0):[];
  await db(`recipes?product_id=eq.${productId}`,{method:"DELETE"});
  if(clean.length)await db("recipes",{method:"POST",body:clean.map(x=>({product_id:productId,ingredient_id:x.ingredientId,amount:Number(x.amount)}))});
}
async function saveOptions(productId,options=[]){
  const clean=[...new Set((Array.isArray(options)?options:[]).map(item=>String(item||"").trim()).filter(Boolean))].slice(0,12);
  await db(`product_options?product_id=eq.${productId}`,{method:"DELETE"});
  if(clean.length)await db("product_options",{method:"POST",body:clean.map((name,sort_order)=>({product_id:productId,name,sort_order}))});
}
async function consumeInventory(lines,orderId){
  const ids=lines.map(x=>x.product.id).join(",");if(!ids)return;
  const recipes=await db(`recipes?product_id=in.(${ids})&select=*`);
  for(const row of recipes){
    const line=lines.find(x=>x.product.id===row.product_id);if(!line)continue;
    const ingredient=one(await db(`ingredients?id=eq.${row.ingredient_id}&select=*`));if(!ingredient)continue;
    const amount=Number(row.amount)*line.quantity;
    await db(`ingredients?id=eq.${ingredient.id}`,{method:"PATCH",body:{stock:Math.max(0,Number(ingredient.stock)-amount)}});
    await db("inventory_movements",{method:"POST",body:{ingredient_id:ingredient.id,amount:-amount,reason:"Venta",order_id:orderId}});
  }
}
async function restoreInventory(order){
  const items=await db(`order_items?order_id=eq.${order.id}&select=*`);
  const ids=items.map(item=>item.product_id).filter(Boolean).join(",");if(!ids)return;
  const recipes=await db(`recipes?product_id=in.(${ids})&select=*`);
  for(const recipe of recipes){
    const line=items.find(item=>item.product_id===recipe.product_id);if(!line)continue;
    const ingredient=one(await db(`ingredients?id=eq.${recipe.ingredient_id}&select=*`));if(!ingredient)continue;
    const amount=Number(recipe.amount)*Number(line.quantity);
    await db(`ingredients?id=eq.${ingredient.id}`,{method:"PATCH",body:{stock:Number(ingredient.stock)+amount}});
    await db("inventory_movements",{method:"POST",body:{ingredient_id:ingredient.id,amount,reason:"Anulación de venta",order_id:order.id}});
  }
}
async function customerBalances(location){
  const customers=await db(`customers?location_id=eq.${location.id}&select=*&order=name.asc`);
  const ids=customers.map(item=>item.id).join(",");
  const ledger=ids?await db(`customer_ledger?customer_id=in.(${ids})&select=*&order=created_at.desc`):[];
  const orderIds=[...new Set(ledger.map(item=>item.order_id).filter(Boolean))].join(",");
  const related=orderIds?await db(`orders?id=in.(${orderIds})&select=id,code,total,created_at`):[];
  const orderMap=Object.fromEntries(related.map(order=>[order.id,order]));
  return customers.map(customer=>{
    const moves=ledger.filter(move=>move.customer_id===customer.id);
    const balance=Math.max(0,moves.reduce((sum,move)=>sum+(move.kind==="charge"?Number(move.amount):-Number(move.amount)),0));
    let outstanding=0,debtSince=null;
    [...moves].reverse().forEach(move=>{if(move.kind==="charge"){if(outstanding<=0)debtSince=move.created_at;outstanding+=Number(move.amount)}else{outstanding=Math.max(0,outstanding-Number(move.amount));if(!outstanding)debtSince=null}});
    return {id:customer.id,name:customer.name,phone:customer.phone||"",creditLimit:Number(customer.credit_limit)||0,notes:customer.notes||"",active:customer.active!==false,balance,debtSince:balance>0?debtSince:null,movements:moves.map(move=>({id:move.id,kind:move.kind,amount:Number(move.amount),method:move.method||"",note:move.note||"",orderId:move.order_id,orderCode:orderMap[move.order_id]?.code||"",createdAt:move.created_at}))};
  });
}
async function creditPaymentReceipts(location){
  const customers=await customerBalances(location);
  return customers.flatMap(customer=>customer.movements.filter(move=>move.kind==="payment").map(move=>({...move,customerId:customer.id,customerName:customer.name})));
}
async function openTableAccounts(location){
  const [tables,orders]=await Promise.all([
    db(`dining_tables?location_id=eq.${location.id}&select=*&order=code.asc`),
    db(`orders?location_id=eq.${location.id}&order_type=eq.table&status=in.(new,preparing,ready)&select=*&order=created_at.asc`)
  ]);
  return tables.map(table=>{
    const rows=orders.filter(order=>order.table_id===table.id);
    return {tableId:Number(table.code),tableName:table.name,orders:rows.map(order=>({id:order.id,code:order.code,total:Number(order.total),customerName:order.customer_name||"",status:order.status,createdAt:order.created_at})),total:rows.reduce((sum,order)=>sum+Number(order.total),0)};
  }).filter(account=>account.orders.length);
}
async function settleTable(location,input){
  const table=await tableFor(location,input.tableId);if(!table)throw new Error("Mesa inválida.");
  const rows=await db(`orders?location_id=eq.${location.id}&table_id=eq.${table.id}&order_type=eq.table&status=in.(new,preparing,ready)&select=*`);
  if(!rows.length)throw new Error("Esta mesa no tiene pedidos pendientes.");
  const total=rows.reduce((sum,row)=>sum+Number(row.total),0),customerId=String(input.customerId||"");
  if(input.mode==="credit"){
    const customer=one(await db(`customers?id=eq.${customerId}&location_id=eq.${location.id}&active=eq.true&select=*`));
    if(!customer)throw new Error("Selecciona un cliente fiado activo.");
    const balances=await customerBalances(location),current=balances.find(item=>item.id===customer.id)?.balance||0,limit=Number(customer.credit_limit)||0;
    if(limit>0&&current+total>limit)throw new Error("El cupo de este cliente no alcanza para esta cuenta.");
    for(const row of rows){
      await db(`orders?id=eq.${row.id}`,{method:"PATCH",body:{status:"completed",customer_id:customer.id}});
      await db("customer_ledger",{method:"POST",body:{customer_id:customer.id,order_id:row.id,kind:"charge",amount:Number(row.total),method:"Fiado",note:`Cuenta mesa ${table.code}`}});
    }
    return {tableId:Number(table.code),tableName:table.name,total,mode:"credit",customer:{id:customer.id,name:customer.name},orders:await Promise.all(rows.map(orderWithItems))};
  }
  const method=["Efectivo","Tarjeta","Nequi","Transferencia"].includes(input.method)?input.method:"Efectivo";
  for(const row of rows){
    await db(`orders?id=eq.${row.id}`,{method:"PATCH",body:{status:"completed"}});
    await db("payments",{method:"POST",body:{order_id:row.id,amount:Number(row.total),method}});
  }
  return {tableId:Number(table.code),tableName:table.name,total,mode:"payment",method,orders:await Promise.all(rows.map(orderWithItems))};
}

export default async request=>{
  try{
    const path=new URL(request.url).pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/,"")||"/";
    if(path==="/menu"&&request.method==="GET"){
      return publicJson(await publicMenu());
    }
    if(path==="/auth/login"&&request.method==="POST"){
      const data=await setup();await staffAccounts(data.org,data.location);const input=await readBody(request);const {url,service}=keys();
      const response=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:service,"content-type":"application/json"},body:JSON.stringify({email:String(input.email||"").trim(),password:String(input.pin||"")})});
      const session=await response.json();if(!response.ok)return fail("Correo o PIN incorrecto.",401);
      const profile=one(await db(`profiles?id=eq.${session.user.id}&select=*`));
      const roles={admin:"Administrador",manager:"Administrador",cashier:"Caja",bar:"Barra",kitchen:"Cocina"};
      return json({user:{name:profile.name,email:session.user.email,role:roles[profile.role],token:session.access_token}});
    }
    if(path==="/auth/me"&&request.method==="GET")return json({user:await currentUser(request)});
    if(path==="/auth/logout"&&request.method==="POST")return json({ok:true});
    if(path==="/orders"&&request.method==="POST"){if(!allowPublicRequest(request,"orders",5))return fail("Espera un momento antes de enviar otro pedido.",429);const order=await addOrder(await readBody(request));return json({order,trackUrl:`/track.html?order=${order.id}`},201)}
    if(path==="/orders"&&request.method==="GET"){const user=await currentUser(request);requireRole(user,["Administrador","Caja","Barra","Cocina"]);const {location}=await dataContext();const rows=await db(`orders?location_id=eq.${location.id}&select=*&order=created_at.desc&limit=100`);return json({orders:await Promise.all(rows.map(orderWithItems))})}
    const tracking=path.match(/^\/orders\/([^/]+)\/track$/);
    if(tracking&&request.method==="GET"){const row=one(await db(`orders?id=eq.${tracking[1]}&select=*`));return row?json({order:await orderWithItems(row)}):fail("Pedido no encontrado.",404)}
    const status=path.match(/^\/orders\/([^/]+)\/status$/);
    if(status&&request.method==="PATCH"){const user=await currentUser(request);requireRole(user,["Administrador","Caja","Barra","Cocina"]);const input=await readBody(request),{location}=await dataContext();if(!["new","preparing","ready","completed","cancelled"].includes(input.status))return fail("Estado inválido.");const previous=one(await db(`orders?id=eq.${status[1]}&location_id=eq.${location.id}&select=*`));if(!previous)return fail("Pedido no encontrado.",404);if(input.status==="cancelled"&&previous.status!=="cancelled"){await restoreInventory(previous);if(previous.customer_id)await db(`customer_ledger?order_id=eq.${previous.id}&kind=eq.charge`,{method:"DELETE"})}const row=one(await db(`orders?id=eq.${status[1]}&location_id=eq.${location.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{status:input.status}}));return json({order:await orderWithItems(row)})}
    if(path==="/table-requests"&&request.method==="POST"){
      if(!allowPublicRequest(request,"requests",8))return fail("Espera un momento antes de enviar otra solicitud.",429);const input=await readBody(request);const {location}=await dataContext();const table=await tableFor(location,input.tableId);if(!table)return fail("Mesa inválida.");
      const created=one(await db("table_requests",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:location.id,table_id:table.id,request_type:["Cuenta","Agua","Mesero","Cubiertos"].includes(input.type)?input.type:"Mesero",note:String(input.note||"").slice(0,120)}}));return json({request:created},201);
    }
    const user=await currentUser(request);
    if(path==="/tables/accounts"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const {location}=await dataContext();return json({accounts:await openTableAccounts(location)});
    }
    const settlePath=path.match(/^\/tables\/(\d+)\/settle$/);
    if(settlePath&&request.method==="POST"){
      requireRole(user,["Administrador","Caja"]);const cash=one(await db("cash_sessions?closed_at=is.null&select=id&limit=1"));if(!cash)return fail("Abre caja antes de cobrar.");const {location}=await dataContext();const input=await readBody(request);const settlement=await settleTable(location,{...input,tableId:Number(settlePath[1])});return json({settlement});
    }
    if(path==="/customers"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const {location}=await dataContext();return json({customers:await customerBalances(location)});
    }
    if(path==="/customers"&&request.method==="POST"){
      requireRole(user,["Administrador","Caja"]);const input=await readBody(request),{location}=await dataContext(),name=String(input.name||"").trim();if(!name)return fail("Escribe el nombre del cliente.");const customer=one(await db("customers",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:location.id,name:name.slice(0,80),phone:String(input.phone||"").slice(0,30),credit_limit:Math.max(0,Number(input.creditLimit)||0),notes:String(input.notes||"").slice(0,300),active:true}}));return json({customer},201);
    }
    const customerPath=path.match(/^\/customers\/([^/]+)(\/payment)?$/);
    if(customerPath&&request.method==="PATCH"){
      requireRole(user,["Administrador","Caja"]);const input=await readBody(request),{location}=await dataContext();const existing=one(await db(`customers?id=eq.${customerPath[1]}&location_id=eq.${location.id}&select=*`));if(!existing)return fail("Cliente no encontrado.");
      if(customerPath[2]){const amount=Math.max(0,Number(input.amount)||0);if(!amount)return fail("Escribe un abono válido.");const balance=(await customerBalances(location)).find(item=>item.id===existing.id)?.balance||0;if(!balance)return fail("Este cliente no tiene saldo fiado pendiente.");if(amount>balance)return fail(`El pago supera el saldo pendiente de ${balance}.`);const payment=one(await db("customer_ledger",{method:"POST",headers:{Prefer:"return=representation"},body:{customer_id:existing.id,kind:"payment",amount,method:["Efectivo","Tarjeta","Nequi","Transferencia"].includes(input.method)?input.method:"Efectivo",note:String(input.note||"").slice(0,160)}}));return json({payment});}
      const customer=one(await db(`customers?id=eq.${existing.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{name:String(input.name??existing.name).slice(0,80),phone:String(input.phone??existing.phone??"").slice(0,30),credit_limit:Math.max(0,Number(input.creditLimit??existing.credit_limit)||0),notes:String(input.notes??existing.notes??"").slice(0,300),active:input.active!==false}}));return json({customer});
    }
    if(path==="/dashboard"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const {location}=await dataContext();const [orders,ingredients,creditReceipts]=await Promise.all([db(`orders?location_id=eq.${location.id}&select=id,total,status,created_at`),db(`ingredients?location_id=eq.${location.id}&select=id,name,stock,minimum_stock`),creditPaymentReceipts(location)]);const paidOrders=orders.filter(x=>x.status==="completed"),ids=paidOrders.map(item=>item.id).join(","),payments=ids?await db(`payments?order_id=in.(${ids})&select=*`):[],today=new Date().toDateString();const sales=[...payments,...creditReceipts].filter(item=>new Date(item.created_at||item.createdAt).toDateString()===today).reduce((sum,item)=>sum+Number(item.amount),0);const lowStock=ingredients.filter(item=>Number(item.stock)<=Number(item.minimum_stock));return json({sales,orders:orders.length,active:orders.filter(x=>!["completed","cancelled"].includes(x.status)).length,lowStock});
    }
    if(path==="/catalog"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const {data,products}=await productsData();const [inventory,tables,requests]=await Promise.all([db(`ingredients?location_id=eq.${data.location.id}&select=*&order=name.asc`),db(`dining_tables?location_id=eq.${data.location.id}&select=*&order=code.asc`),db(`table_requests?location_id=eq.${data.location.id}&resolved_at=is.null&select=*&order=created_at.desc`)]);const inventoryIds=inventory.map(item=>item.id).join(","),moves=inventoryIds?await db(`inventory_movements?ingredient_id=in.(${inventoryIds})&select=*&order=created_at.desc&limit=40`):[];
      return json({products,inventory:inventory.map(x=>({id:x.id,name:x.name,unit:x.unit,stock:Number(x.stock),minimum:Number(x.minimum_stock),cost:Number(x.cost)})),tables:tables.map(x=>({id:Number(x.code),name:x.name,active:x.active})),location:publicLocation(data.location),inventoryMoves:moves.map(x=>({id:x.id,ingredientId:x.ingredient_id,quantity:Number(x.amount),reason:x.reason,createdAt:x.created_at})),tableRequests:requests.map(x=>({id:x.id,tableId:x.table_id,type:x.request_type,note:x.note,createdAt:x.created_at}))});
    }
    const requestPath=path.match(/^\/table-requests\/([^/]+)\/resolve$/);
    if(requestPath&&request.method==="PATCH"){
      requireRole(user,["Administrador","Caja","Barra","Cocina"]);
      const {location}=await dataContext();const requestRow=one(await db(`table_requests?id=eq.${requestPath[1]}&location_id=eq.${location.id}&select=*`));
      if(!requestRow)return fail("Solicitud no encontrada.",404);
      const resolved=one(await db(`table_requests?id=eq.${requestRow.id}&location_id=eq.${location.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{resolved_at:new Date().toISOString(),resolved_by:user.id}}));
      return json({request:resolved});
    }
    if(path==="/inventory"&&request.method==="POST"){
      requireRole(user);const input=await readBody(request);const {location}=await dataContext();const ingredient=one(await db("ingredients",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:location.id,name:String(input.name||"").trim(),unit:String(input.unit||"und"),stock:Math.max(0,Number(input.stock)||0),minimum_stock:Math.max(0,Number(input.minimum)||0),cost:Math.max(0,Number(input.cost)||0)}}));invalidatePublicMenu();return json({ingredient},201);
    }
    const inventoryPath=path.match(/^\/inventory\/([^/]+)(\/restock)?$/);
    if(inventoryPath&&request.method==="PATCH"){
      requireRole(user);const input=await readBody(request),{location}=await dataContext();const old=one(await db(`ingredients?id=eq.${inventoryPath[1]}&location_id=eq.${location.id}&select=*`));if(!old)return fail("Insumo no encontrado.",404);const stock=inventoryPath[2]?Number(old.stock)+Math.max(0,Number(input.quantity)||0):Math.max(0,Number(input.stock));const ingredient=one(await db(`ingredients?id=eq.${old.id}&location_id=eq.${location.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{name:input.name??old.name,unit:input.unit??old.unit,stock,minimum_stock:input.minimum??old.minimum_stock,cost:input.cost??old.cost}}));await db("inventory_movements",{method:"POST",body:{ingredient_id:old.id,amount:stock-Number(old.stock),reason:inventoryPath[2]?"Entrada de inventario":"Ajuste de inventario"}});invalidatePublicMenu();return json({ingredient});
    }
    if(path==="/products"&&request.method==="POST"){
      requireRole(user);const input=await readBody(request);const data=await dataContext();const product=one(await db("products",{method:"POST",headers:{Prefer:"return=representation"},body:{location_id:data.location.id,category_id:await categoryId(data,input.category),name:String(input.name||"").trim(),description:String(input.description||""),price:Number(input.price)||0,active:input.active!==false,image_url:String(input.imageUrl||"")}}));await saveRecipe(product.id,input.recipe);await saveOptions(product.id,input.options);invalidatePublicMenu();return json({product},201);
    }
    const productPath=path.match(/^\/products\/([^/]+)(\/image)?$/);
    if(productPath&&(request.method==="PATCH"||request.method==="POST")){
      requireRole(user);const input=await readBody(request);const data=await dataContext();const changes=productPath[2]?{image_url:String(input.imageUrl||"")}:{name:String(input.name||""),description:String(input.description||""),price:Number(input.price)||0,category_id:await categoryId(data,input.category),active:input.active!==false};const product=one(await db(`products?id=eq.${productPath[1]}&location_id=eq.${data.location.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:changes}));if(!product)return fail("Producto no encontrado.",404);if(!productPath[2]){await saveRecipe(product.id,input.recipe);await saveOptions(product.id,input.options)}invalidatePublicMenu();return json({product});
    }
    if(path==="/settings"&&request.method==="PATCH"){
      requireRole(user);const input=await readBody(request);const {location}=await dataContext();const saved=one(await db(`locations?id=eq.${location.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{name:String(input.name||location.name),address:String(input.address||""),hours:String(input.hours||""),whatsapp:String(input.whatsapp||""),instagram:String(input.instagram||"")}}));return json({location:publicLocation(saved)});
    }
    if(path==="/pos/open-order"&&request.method==="POST"){requireRole(user,["Administrador","Caja"]);const input=await readBody(request);const order=await addOrder({...input,type:"table"},false);return json({order},201)}
    if(path==="/pos/sale"&&request.method==="POST"){requireRole(user,["Administrador","Caja"]);const cash=one(await db("cash_sessions?closed_at=is.null&select=id&limit=1"));if(!cash)return fail("Abre caja antes de facturar.");const order=await addOrder({...await readBody(request),type:"takeaway"},true);return json({order},201)}
    if(path==="/reports/sales"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const {location}=await dataContext();const rows=await db(`orders?location_id=eq.${location.id}&status=eq.completed&select=*&order=created_at.desc`);const orders=await Promise.all(rows.map(orderWithItems));const ids=orders.map(item=>item.id).join(","),[payments,creditReceipts]=await Promise.all([ids?db(`payments?order_id=in.(${ids})&select=*`):[],creditPaymentReceipts(location)]);const now=Date.now(),day=86400000,receipts=[...payments.map(item=>({amount:Number(item.amount),method:item.method||"Efectivo",createdAt:item.created_at,type:"sale"})),...creditReceipts.map(item=>({amount:Number(item.amount),method:item.method||"Efectivo",createdAt:item.createdAt,type:"credit",customerName:item.customerName}))],sum=window=>receipts.filter(item=>now-new Date(item.createdAt).getTime()<window).reduce((n,item)=>n+item.amount,0);return json({today:sum(day),week:sum(day*7),month:sum(day*31),invoices:orders.map(order=>{const payment=payments.find(item=>item.order_id===order.id);return {order,amount:order.total,method:payment?.method||(order.customerId?"Fiado":"Pendiente"),paid:Boolean(payment)}}),creditCollections:creditReceipts.map(item=>({customerName:item.customerName,amount:Number(item.amount),method:item.method||"Efectivo",createdAt:item.createdAt}))});
    }
    if(path==="/cash/current"&&request.method==="GET"){
      requireRole(user,["Administrador","Caja"]);const session=one(await db("cash_sessions?closed_at=is.null&select=*&order=opened_at.desc&limit=1"));return json({session:session?{id:session.id,openedBy:session.opened_by,openingAmount:Number(session.opening_amount),openedAt:session.opened_at}:null});
    }
    if(path==="/cash/open"&&request.method==="POST"){
      requireRole(user,["Administrador","Caja"]);if(one(await db("cash_sessions?closed_at=is.null&select=id")))return fail("Ya hay una caja abierta.");const input=await readBody(request);const session=one(await db("cash_sessions",{method:"POST",headers:{Prefer:"return=representation"},body:{opened_by:user.name,opening_amount:Math.max(0,Number(input.amount)||0)}}));return json({session:{id:session.id,openedBy:session.opened_by,openingAmount:Number(session.opening_amount),openedAt:session.opened_at}},201);
    }
    if(path==="/cash/close"&&request.method==="POST"){
      requireRole(user,["Administrador","Caja"]);const active=one(await db("cash_sessions?closed_at=is.null&select=*&limit=1"));if(!active)return fail("No hay una caja abierta.");const input=await readBody(request);const {location}=await dataContext();const openedAt=encodeURIComponent(active.opened_at);const [orders,creditReceipts]=await Promise.all([db(`orders?location_id=eq.${location.id}&status=eq.completed&created_at=gte.${openedAt}&select=id,total`),creditPaymentReceipts(location)]);const ids=orders.map(item=>item.id).join(","),payments=ids?await db(`payments?order_id=in.(${ids})&select=*`):[],cashSales=payments.filter(payment=>payment.method==="Efectivo").reduce((sum,payment)=>sum+Number(payment.amount),0),creditCash=creditReceipts.filter(payment=>payment.method==="Efectivo"&&new Date(payment.createdAt)>=new Date(active.opened_at)).reduce((sum,payment)=>sum+Number(payment.amount),0),expected=Number(active.opening_amount)+cashSales+creditCash;const counted=Math.max(0,Number(input.amount)||0);const session=one(await db(`cash_sessions?id=eq.${active.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:{closed_by:user.name,closing_amount:counted,closed_at:new Date().toISOString()}}));return json({session,summary:{opening:Number(active.opening_amount),cashSales,creditCash,expected,counted,difference:counted-expected}});
    }
    return fail("Ruta no encontrada.",404);
  }catch(reason){return fail(reason.message||"Error inesperado.",reason.message?.includes("Inicia sesión")?401:500)}
};
