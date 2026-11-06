import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

const purple = Color(0xFF683CF0);
const ink = Color(0xFF1C1935);
const soft = Color(0xFFF2EDFF);
const payerOrigin = String.fromEnvironment('PAYER_ORIGIN', defaultValue: 'https://splitsync-demo-leah-nov06.exoticjewel8.chatgpt.site');
void main() => runApp(const SplitSync());
class SplitSync extends StatelessWidget {
  const SplitSync({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'SplitSync AI', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, scaffoldBackgroundColor: const Color(0xFFFAF9FD),
      colorScheme: ColorScheme.fromSeed(seedColor: purple, primary: purple),
      textTheme: const TextTheme(headlineMedium: TextStyle(fontSize: 29, fontWeight: FontWeight.w800, color: ink, letterSpacing: -1), titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: ink)),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 17), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE9E5F1))))),
    home: const Demo());
}
class Demo extends StatefulWidget {
  const Demo({super.key});
  @override
  State<Demo> createState() => _DemoState();
}
class _DemoState extends State<Demo> {
  String page = 'welcome', lamp = 'Maya', selected = 'Maya', result = 'processing';
  bool scanning = false, published = false;
  final instruction = TextEditingController(text: 'Split the \$120 kitchen essentials equally between Maya, Arun and Leah. The \$30 lamp is for Maya.');
  final link = TextEditingController();
  final interests = <String>{};
  final names = const ['Maya','Arun','Leah'];
  int share(String n) => 40 + (n == lamp ? 30 : 0);
  String money(num n) => '\$${n.toStringAsFixed(2)}';
  void go(String p) => setState(() { page = p; scanning = false; });
  void message(String s) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  @override
  void dispose() { instruction.dispose(); link.dispose(); super.dispose(); }
  Widget badge() => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(7)), child: const Text('Sandbox demo', style: TextStyle(color: purple, fontSize: 11, fontWeight: FontWeight.w700)));
  Widget heading(String title, [String subtitle='']) => Padding(padding: const EdgeInsets.only(bottom: 22), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: Theme.of(context).textTheme.headlineMedium), if(subtitle.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 9), child: Text(subtitle, style: const TextStyle(color: Color(0xFF817C96), height: 1.6)))]));
  Widget card(Widget child) => Container(width: double.infinity, padding: const EdgeInsets.all(21), margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(17), border: Border.all(color: const Color(0xFFE9E5F1))), child: child);
  Widget note(String text) => Container(width: double.infinity, margin: const EdgeInsets.symmetric(vertical: 14), padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(12)), child: Text('✧  $text', style: const TextStyle(color: Color(0xFF786493), height: 1.6, fontSize: 12)));
  Widget action(String text, String next, {bool secondary=false}) => Padding(padding: const EdgeInsets.only(top: 9), child: SizedBox(width: double.infinity, child: secondary ? OutlinedButton(onPressed: () => go(next), child: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(text))) : FilledButton(onPressed: () => go(next), child: Text(text))));
  Widget line(String name, String value, {bool bold=false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 13), child: Row(children: [Expanded(child: Text(name, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.w400))), Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600))]));
  Widget merchant() => const ListTile(contentPadding: EdgeInsets.zero, leading: CircleAvatar(backgroundColor: soft, child: Icon(Icons.storefront_outlined, color: purple)), title: Text('Move-in essentials', style: TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Demo Merchant · SS-001'));
  Widget receipt() => card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Original bill', style: Theme.of(context).textTheme.titleLarge), merchant(), const Divider(), line('Shared kitchen essentials', '\$120.00'), line('Lamp ($lamp)', '\$30.00'), const Divider(), line('Total', '\$150.00 USD', bold:true), badge()]));
  Widget participant(String n, {bool status=false}) => ListTile(contentPadding: EdgeInsets.zero, leading: CircleAvatar(backgroundColor: n=='Arun' ? const Color(0xFFE0ECE7) : soft, child: Text(n[0], style: const TextStyle(color: purple))), title: Text(n, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(status ? (n=='Maya' ? 'Paid' : n=='Arun' ? 'Processing' : 'Awaiting payment') : (n==lamp ? '\$40 shared + \$30 lamp' : 'Shared essentials')), trailing: Text(money(share(n)), style: const TextStyle(fontWeight: FontWeight.w700)));
  Widget two(Widget left, Widget right) => LayoutBuilder(builder: (context, constraints) => constraints.maxWidth > 680 ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child:left), const SizedBox(width:22), Expanded(child:right)]) : Column(children:[left,right]));
  Widget welcome() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const SizedBox(height:40), const Icon(Icons.link, size:70, color:purple), const SizedBox(height:24), heading('Split shared purchases\nand see who’s paid.', 'From the merchant’s QR to the last payment. A little less admin, a little more together.'), note('A walkthrough with Maya, Arun and Leah. No real money moves.'), action('Continue as demo organizer', 'home'), action('Shopping preferences', 'preferences', secondary:true)]);
  Widget home() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [heading('Good afternoon, Leah ☀', 'Your shared purchases, all in one place.'), card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('New place. Shared things.', style: Theme.of(context).textTheme.titleLarge), const Text('One simple split.'), action('Scan QR', 'scan')])), heading('Active shared purchases'), card(Column(children: [merchant(), line('Total', '\$150.00 USD', bold:true), badge(), const SizedBox(height:20), LinearProgressIndicator(value:share('Maya')/150, color:purple, backgroundColor:soft, borderRadius:BorderRadius.circular(10), minHeight:7), line('1 of 3 paid', '${money(150-share('Maya'))} remaining'), action('View group payment', 'status')])), Row(children:[Expanded(child:action('Rent', 'rent', secondary:true)), const SizedBox(width:10), Expanded(child:action('Shop','shop',secondary:true))])]);
  Widget scanner({bool error=false}) {
    Widget preview;
    if (error) {
      preview = Container(color: ink, child: const Center(child: Padding(
        padding: EdgeInsets.all(28), child: Text('Camera access unavailable. Allow access in Settings or use a fallback.',
        textAlign: TextAlign.center, style: TextStyle(color: Colors.white, height: 1.7)))));
    } else if (scanning) {
      preview = MobileScanner(onDetect: (capture) {
        if (page != 'scan') return;
        final raw = capture.barcodes.firstOrNull?.rawValue;
        if (raw == null) return;
        go(raw.contains('#purchase/SS-001') ? 'review' : 'unsupported');
      }, errorBuilder: (context, error) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Camera unavailable'), TextButton(onPressed: () => go('scan-error'), child: const Text('Use fallback actions'))
      ])));
    } else {
      preview = Container(decoration: const BoxDecoration(gradient: LinearGradient(
        colors: [Color(0xFF526D60), Color(0xFFAA9279)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        child: Center(child: Container(width: 210, height: 260,
          decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(24)),
          child: Center(child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.storefront, color: purple), const Text('Demo Merchant'),
            const Text('Move-in essentials', style: TextStyle(fontSize: 10)),
            QrImageView(data: '$payerOrigin/#purchase/SS-001', size: 120)
          ])))))));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      heading('Scan merchant QR', 'Point your camera at the merchant QR'),
      two(ClipRRect(borderRadius: BorderRadius.circular(17), child: SizedBox(height: 330, child: preview)),
        card(Column(children: [
          if (!error) FilledButton(onPressed: () => setState(() => scanning = true), child: const Text('Enable camera')),
          action('Open demo purchase', 'review'), const SizedBox(height: 14),
          TextField(controller: link, decoration: const InputDecoration(labelText: 'Paste merchant link')),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => go(link.text.contains('#purchase/SS-001') ? 'review' : 'unsupported'), child: const Text('Open pasted link')),
          action('Preview permission denied', 'scan-error', secondary: true),
          note('Use a merchant QR containing #purchase/SS-001, or open the demo purchase.')
        ])))
    ]);
  }
  Widget review() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Review purchase','Check the bill before preparing your split.'),two(receipt(),card(Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('Who’s sharing?',style:Theme.of(context).textTheme.titleLarge),...names.map((n)=>participant(n)),const SizedBox(height:14),TextField(controller:instruction,maxLines:4,decoration:const InputDecoration(labelText:'Split instruction')),note('Rule-based demo allocation. Review and edit before publishing.'),SizedBox(width:double.infinity,child:FilledButton(onPressed:()=>go(instruction.text.toLowerCase().contains('maya')?'split':'clarify'),child:const Text('Prepare AI split')))]))) ]);
  Widget allocation({bool edit=false, bool clarify=false}) => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading(clarify?'Who should pay for the lamp?':'AI split review','\$150.00 allocated'),two(receipt(),card(Column(crossAxisAlignment:CrossAxisAlignment.start,children:[if(edit||clarify) DropdownButtonFormField<String>(value:lamp,decoration:const InputDecoration(labelText:'Lamp owner'),items:names.map((n)=>DropdownMenuItem(value:n,child:Text(n))).toList(),onChanged:(n)=>setState(()=>lamp=n!)),...names.map((n)=>ExpansionTile(key:ValueKey('$n-$lamp'),initiallyExpanded:n==lamp,tilePadding:EdgeInsets.zero,leading:CircleAvatar(backgroundColor:soft,child:Text(n[0])),title:Text(n,style:const TextStyle(fontWeight:FontWeight.w700)),trailing:Text(money(share(n)),style:const TextStyle(color:purple,fontWeight:FontWeight.w800)),children:[line('Shared essentials (1 of 3)','\$40.00'),if(n==lamp)line('Personal lamp','\$30.00')])),note('\$120 shared essentials split evenly (\$40 each) + \$30 lamp for $lamp.'),Row(children:[Expanded(child:OutlinedButton(onPressed:()=>go(edit||clarify?'split':'edit'),child:Text(edit||clarify?'Review split':'Edit split'))),const SizedBox(width:10),Expanded(child:FilledButton(onPressed:(){published=true;go('requests');},child:const Text('Confirm split')))])]))) ]);
  Widget requests() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Ready to share.','Each person gets a link to their own share.'),badge(),const SizedBox(height:16),...names.map((n)=>card(Column(children:[participant(n),Row(children:[Expanded(child:OutlinedButton(onPressed:(){Clipboard.setData(ClipboardData(text:'$payerOrigin/#share/${n.toLowerCase()}'));message('$n’s link copied');},child:const Text('Copy link'))),const SizedBox(width:12),Expanded(child:FilledButton(onPressed:(){selected=n;go('qr');},child:const Text('Show QR')))])]))),action('Track group payment','status')]);
  Widget qr() => card(Column(children:[heading('$selected · ${money(share(selected))} USD'),badge(),const SizedBox(height:20),QrImageView(data:'$payerOrigin/#share/${selected.toLowerCase()}',size:250),const Text('Scan to review this person’s share.'),action('Preview participant page','payer'),action('Back to requests','requests',secondary:true)]));
  Widget status() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Group payment','Move-in essentials · Sandbox demo'),two(card(Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('${money(share('Maya'))} paid',style:Theme.of(context).textTheme.headlineMedium),const Text('of \$150.00 USD'),const SizedBox(height:20),LinearProgressIndicator(value:share('Maya')/150,color:purple,backgroundColor:soft,minHeight:8),line('Remaining',money(150-share('Maya'))),const Text('1 of 3 paid'),note('Processing is counted as paid only after confirmation. Sample statuses.'),action('Share payment requests','requests')])),card(Column(children:[...names.map((n)=>participant(n,status:true)),action('Original bill & allocations','dashboard',secondary:true)]))) ]);
  Widget payer() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Your share · ${money(share(selected))} USD','Hi $selected, here’s your part.'),two(card(Column(children:[merchant(),line('Shared essentials (1 of 3)','\$40.00'),if(selected==lamp)line('Personal lamp','\$30.00')])),card(Column(children:[Text('Payment summary',style:Theme.of(context).textTheme.titleLarge),line('Total to pay','${money(share(selected))} USD',bold:true),badge(),const SizedBox(height:20),SizedBox(width:double.infinity,child:FilledButton(style:FilledButton.styleFrom(backgroundColor:const Color(0xFFFFC439),foregroundColor:const Color(0xFF003087)),onPressed:()=>go('handoff'),child:const Text('Pay with PayPal'))),note('Storyboard only. Actual approval happens on PayPal’s own screen.')])))]);
  Widget handoff() => card(Column(children:[const Text('PayPal',style:TextStyle(fontSize:34,fontWeight:FontWeight.w800,fontStyle:FontStyle.italic,color:Color(0xFF003087))),heading('Continue in PayPal Sandbox'),badge(),line(selected,'${money(share(selected))} USD'),const Text('Preview the result. No PayPal order is created in this demo.'),...['processing','paid','cancelled'].map((s)=>Padding(padding:const EdgeInsets.only(top:12),child:FilledButton(onPressed:(){result=s;go('result');},child:Text('Preview $s')))),action('Return to your share','payer',secondary:true)]));
  Widget paymentResult() => card(Column(children:[Icon(result=='paid'?Icons.check_circle:result=='cancelled'?Icons.undo:Icons.schedule,color:result=='paid'?Colors.green:purple,size:70),const SizedBox(height:20),heading(result=='paid'?'Payment complete':result=='cancelled'?'Payment cancelled':'Payment processing'),badge(),line('Amount','${money(share(selected))} USD',bold:true),line('Merchant','Demo Merchant'),if(result=='paid')line('Receipt reference','DEMO-SS-8F3D21'),line('Status',result),note(result=='processing'?'Confirmation is pending.':result=='paid'?'Sample payment receipt. No real money moved.':'No payment completed. Return to retry.'),action(result=='cancelled'?'Return to share & retry':'View your share','payer')]));
  Widget rent() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Rent overview','A separate household workflow.'),card(Column(children:[badge(),line('December rent','\$2,400.00 USD',bold:true),line('Due date','December 1, 2026'),const Text('Draft · Saved rule: equal split'),...names.map((n)=>line(n,'\$800.00 · Draft')),note('Each new month starts as a draft the organizer reviews. Rent status is tracked separately.'),FilledButton(onPressed:()=>message('December draft reviewed. Demo only; no requests sent.'),child:const Text('Review monthly draft'))]))]);
  Widget preferences() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('What’s on your list?','Optional shopping preferences.'),...['Kitchen','Furniture','Move-in essentials'].map((n)=>CheckboxListTile(title:Text(n),value:interests.contains(n),onChanged:(v)=>setState(()=>v!?interests.add(n):interests.remove(n)))),action('Save preferences','shop'),action('Skip','shop',secondary:true)]);
  Widget shop() => Column(crossAxisAlignment:CrossAxisAlignment.start,children:[heading('Make the new place yours.','Budget: \$120 · Need: shared kitchen essentials'),card(Column(children:[const Icon(Icons.kitchen_outlined,size:90,color:purple),line('Kitchen essentials bundle','\$120.00'),const Text('Demo Merchant'),badge(),action('View product','product')])),card(Column(children:[const Icon(Icons.chair_outlined,size:90,color:purple),const Text('Furniture · IKEA'),const Text('Browse current prices at the retailer.'),TextButton(onPressed:()async{final ok=await launchUrl(Uri.parse('https://www.ikea.com/'),mode:LaunchMode.externalApplication);if(!ok)message('Unable to open retailer.');},child:const Text('View at retailer ↗'))])),action('Shopping preferences','preferences',secondary:true)]);
  Widget product() => card(Column(children:[const Icon(Icons.kitchen_outlined,size:120,color:purple),heading('Kitchen essentials bundle','Demo Merchant · Kitchen items, storage and cleaning.'),line('Price','\$120.00 USD',bold:true),badge(),note('Review the existing demo purchase with this bundle and Maya’s lamp.'),action('Add to shared purchase','review')]));
  Widget body() => switch(page) {'welcome'=>welcome(),'home'=>home(),'scan'=>scanner(),'scan-error'=>scanner(error:true),'unsupported'=>card(Column(children:[heading('Unsupported code','Use the merchant demo QR or open the sample purchase.'),action('Try again','scan'),action('Open demo purchase','review',secondary:true)])),'review'=>review(),'split'=>allocation(),'edit'=>allocation(edit:true),'clarify'=>allocation(clarify:true),'requests'=>requests(),'qr'=>qr(),'status'=>status(),'dashboard'=>Column(children:[heading('Organizer dashboard',published?'Confirmed allocations':'Sample confirmed allocations'),receipt(),card(Column(children:names.map((n)=>participant(n,status:true)).toList())),action('Track group payment','status')]),'payer'=>payer(),'handoff'=>handoff(),'result'=>paymentResult(),'rent'=>rent(),'preferences'=>preferences(),'shop'=>shop(),'product'=>product(),_=>home()};
  @override
  Widget build(BuildContext context) => Scaffold(appBar:AppBar(backgroundColor:Colors.white,surfaceTintColor:Colors.transparent,leading:page=='welcome'?null:IconButton(icon:const Icon(Icons.arrow_back),onPressed:()=>go(switch(page){'split'||'clarify'=>'review','edit'=>'split','review'=>'scan','qr'=>'requests','handoff'||'result'=>'payer',_=>'home'})),title:const Row(mainAxisSize:MainAxisSize.min,children:[Icon(Icons.link,color:purple),SizedBox(width:7),Text('SplitSync AI',style:TextStyle(fontWeight:FontWeight.w800,fontSize:19))]),actions:[Padding(padding:const EdgeInsets.only(right:14),child:badge())]),bottomNavigationBar: MediaQuery.sizeOf(context).height < 500 && ['split','edit','clarify','status','scan'].contains(page) ? SafeArea(child:Padding(padding:const EdgeInsets.all(10),child:FilledButton(onPressed:(){if(['split','edit','clarify'].contains(page)){published=true;go('requests');}else{go(page=='scan'?'review':'requests');}},child:Text(['split','edit','clarify'].contains(page)?'Confirm split':page=='scan'?'Open demo purchase':'Share payment requests')))) : null,body:SafeArea(child:SingleChildScrollView(padding:const EdgeInsets.all(22),child:Center(child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:1080),child:body())))));
}
