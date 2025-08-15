import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ListarProdutos from '../produto/produto';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function RoutesTab(){
   
    return(
        <Tab.Navigator>
            <Tab.Screen name="listaritens" component={ListarProdutos} options={{
                                title: 'LIstagem de Produtos',
                                tabBarLabel:'Listar itens',
                                tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="list-status" color={color} size={size}  /> ), }} />                            
           
        </Tab.Navigator>
    )

}    